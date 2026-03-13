import { invokeLLM } from "./_core/llm";
import type { Message as LLMMessage } from "./_core/llm";
import {
  getMenuCategories,
  getMenuItems,
  getRestaurantSettings,
  createOrder,
  createReservation,
  createFeedback,
  getCustomerByWhatsappId,
  createCustomer,
  getActiveConversation,
  createConversation,
  createMessage,
  updateConversation,
  getMessagesByConversation,
  getDb,
  tryClaimMessage,
  getRecentOrdersByCustomer,
  getActiveReservationsByCustomer,
  getConversationMessages,
} from "./db";
import { sendTextMessage, sendButtonMessage, sendListMessage } from "./whatsapp";
import { sendTextMessageEvolution, sendMediaMessageEvolution } from "./evolutionApi";
import { whatsappService } from "./services/whatsappService";
import { buildCustomerContextBlock } from "./services/customerContextBuilder";
import { handleOrderLink, handleOrderStatus, handleSaveReservation } from "./services/chatbotActionHandler";
import { getChatbotPrompt } from "./chatbotPrompt";
import { getNowBRT } from "../shared/businessHours";
import { orderSessions, orders, reservations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { notifyOwner } from "./_core/notification";
import { sanitizeLLMOutput } from "./sanitize";
import { checkChatbotRateLimit } from "./chatbotRateLimit";
import { checkFaqCache } from "./faqCache";
import { logger } from "./utils/logger";
// URL HARDCODED - não usar process.env pois SITE_DEV_URL pode sobrescrever em produção
// Domínio publicado correto: chatbotwa-hesngyeo.manus.space
const SITE_URL = "https://chatbotwa-hesngyeo.manus.space";

interface ChatContext {
  intent?: "order" | "reservation" | "info" | "feedback" | "other";
  orderItems?: Array<{ itemId: number; quantity: number; notes?: string }>;
  deliveryAddress?: string;
  reservationDate?: string;
  reservationPeople?: number;
  awaitingInput?: string;
}

// A deduplicação agora é feita via banco de dados (tryClaimMessage)
// para funcionar entre múltiplas instâncias do servidor (dev + produção).

/**
 * Lock por whatsappId para evitar processamento concorrente de múltiplas
 * mensagens do mesmo cliente (evita race conditions no LLM/DB).
 */
const processingLocks = new Map<string, Promise<void>>();

async function withClientLock(whatsappId: string, fn: () => Promise<void>): Promise<void> {
  // Esperar qualquer processamento anterior do mesmo cliente terminar
  const existing = processingLocks.get(whatsappId);
  if (existing) {
    await existing;
  }

  const promise = fn();
  processingLocks.set(whatsappId, promise);

  try {
    await promise;
  } finally {
    // Só limpar se ainda é a nossa promise
    if (processingLocks.get(whatsappId) === promise) {
      processingLocks.delete(whatsappId);
    }
  }
}

/**
 * Processa uma mensagem recebida do cliente via WhatsApp
 * @param whatsappId - JID completo (ex: 212454869074102@lid ou 5517988112791@s.whatsapp.net)
 * @param phone - Número extraído do JID (pode ser LID ou número real)
 * @param messageText - Texto da mensagem
 * @param messageId - ID único da mensagem
 * @param pushName - Nome do contato no WhatsApp (opcional, usado para preencher nome do cliente)
 * @param realPhone - Número real do telefone quando JID é @lid (extraído de remoteJidAlt)
 */
export async function processIncomingMessage(
  whatsappId: string,
  phone: string,
  messageText: string,
  messageId: string,
  pushName?: string,
  realPhone?: string
): Promise<void> {
  // ===== DEDUPLICAÇÃO DISTRIBUÍDA VIA BANCO DE DADOS =====
  // Garante que apenas UMA instância (dev, produção, webhook, polling)
  // processe cada mensagem, mesmo com múltiplos servidores rodando.
  const claimed = await tryClaimMessage(messageId, "chatbot");
  if (!claimed) {
    console.log(`[Chatbot] ⚠️ Mensagem já processada por outra instância: ${messageId} (de ${phone})`);
    return;
  }

  // ===== LOCK POR CLIENTE: Serializar processamento do mesmo cliente =====
  // Evita race conditions quando múltiplas mensagens chegam simultaneamente
  // para o mesmo cliente (ex: webhook e polling ao mesmo tempo).
  const lockKey = realPhone || phone;
  return withClientLock(lockKey, async () => {
    await _processIncomingMessageInternal(whatsappId, phone, messageText, messageId, pushName, realPhone);
  });
}

/**
 * Implementação interna do processamento de mensagem.
 * Chamada apenas via processIncomingMessage que garante dedup e lock.
 */
async function _processIncomingMessageInternal(
  whatsappId: string,
  phone: string,
  messageText: string,
  messageId: string,
  pushName?: string,
  realPhone?: string
): Promise<void> {
  try {
    // Guardrail: rate limit por whatsappId (máx 30 msgs/hora)
    if (!(await checkChatbotRateLimit(whatsappId))) {
      console.warn(`[Chatbot] Rate limit atingido para ${phone} (${whatsappId})`);
      const limitMsg = "Você enviou muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente, ou ligue para nosso telefone fixo. 😊";
      await whatsappService.sendText(whatsappId, limitMsg);
      return;
    }

    // Guardrail: limitar tamanho da mensagem para evitar abuso de LLM e prompt injection
    const MAX_MSG_LENGTH = 2000;
    if (messageText.length > MAX_MSG_LENGTH) {
      console.warn(`[Chatbot] Mensagem muito longa (${messageText.length} chars) de ${phone} — truncando`);
      messageText = messageText.slice(0, MAX_MSG_LENGTH) + "...";
    }

    // Guardrail: sanitizar tentativas de prompt injection
    // Cobre inglês, português e variantes comuns de obfuscação
    const injectionPatterns = [
      // Inglês
      /ignore (all )?(previous|prior|above) instructions?/gi,
      /you are now/gi,
      /act as (a |an )?/gi,
      /forget (everything|your instructions|all previous)/gi,
      /disregard (all |any )?(previous|prior|above|your) instructions?/gi,
      /new (system )?prompt/gi,
      /override (your )?(instructions?|rules?|guidelines?)/gi,
      // Português
      /ignore (todas as |as )?(instru[çc][õo]es|regras) (anteriores?|acima)/gi,
      /esqueça (tudo|suas instru[çc][õo]es|as regras)/gi,
      /voc[êe] (agora |é |nao |não )?(um|uma|é)/gi,
      /aja como (um|uma)?/gi,
      /finja (ser|que é)/gi,
      /novas instru[çc][õo]es/gi,
      // Marcadores de controle do sistema (evitar que usuário injete ações)
      /\[system\]/gi,
      /\[assistant\]/gi,
      /\[SALVAR_RESERVA:/gi,
      /\[GERAR_LINK_PEDIDO\]/gi,
      /\[CHAMAR_ATENDENTE\]/gi,
      /\[VERIFICAR_STATUS_PEDIDO:/gi,
    ];
    for (const pattern of injectionPatterns) {
      if (pattern.test(messageText)) {
        console.warn(`[Chatbot] Possível prompt injection detectado de ${phone}: ${messageText.slice(0, 100)}`);
        messageText = messageText.replace(pattern, "[mensagem filtrada]");
      }
    }

    // Determinar o número real do telefone:
    // Se temos realPhone (via remoteJidAlt), usar ele. Caso contrário, usar phone.
    const effectivePhone = realPhone || phone;
    // Normalizar: se o effectivePhone contém @s.whatsapp.net, extrair só os dígitos
    const normalizedPhone = effectivePhone.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");

    // 1. Buscar ou criar cliente
    // Passar realPhone para permitir busca inteligente quando JID é @lid
    let customer = await getCustomerByWhatsappId(whatsappId, realPhone);
    if (!customer) {
      // Se temos o número real (via remoteJidAlt), usar ele como whatsappId canônico
      const canonicalWhatsappId = realPhone
        ? realPhone.replace(/\D/g, "") + "@s.whatsapp.net"
        : whatsappId;
      customer = await createCustomer({
        whatsappId: canonicalWhatsappId,
        phone: normalizedPhone,
        name: pushName || null,
        address: null,
      });
    } else {
      // Atualizar dados do cliente se estiverem faltando
      const updates: Record<string, any> = {};
      if (!customer.name && pushName) {
        updates.name = pushName;
      }
      // Se o whatsappId atual é @lid mas temos o número real, atualizar para o formato canônico
      if (realPhone && customer.whatsappId.endsWith("@lid")) {
        const canonicalId = realPhone.replace(/\D/g, "") + "@s.whatsapp.net";
        updates.whatsappId = canonicalId;
        updates.phone = normalizedPhone;
      }
      // Se o phone está com o LID, atualizar para o número real
      if (realPhone && customer.phone && customer.phone.length > 13) {
        updates.phone = normalizedPhone;
      }
      if (Object.keys(updates).length > 0) {
        try {
          const { updateCustomer } = await import("./db");
          await updateCustomer(customer.id, updates);
          // Atualizar o objeto local
          Object.assign(customer, updates);
          console.log(`[Chatbot] Cliente ${customer.id} atualizado:`, Object.keys(updates).join(", "));
        } catch (err) {
          console.error("[Chatbot] Erro ao atualizar cliente:", err);
        }
      }
    }

    // 2. Buscar ou criar conversa ativa
    let conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      conversation = await createConversation({
        customerId: customer.id,
        whatsappMessageId: messageId,
        intent: null,
        context: JSON.stringify({}),
        isActive: true,
      });
    }

    // 3. Salvar mensagem do usuário
    await createMessage({
      conversationId: conversation.id,
      role: "user",
      content: messageText,
      messageType: "text",
      metadata: null,
    });

    // 4. Obter contexto da conversa
    const context: ChatContext = conversation.context ? JSON.parse(conversation.context) : {};

    // 4b. Verificar modo humano: se o operador assumiu a conversa, o bot fica silencioso
    // O modo humano é ativado automaticamente quando o webhook detecta uma mensagem
    // fromMe=true cujo ID NÃO está registrado no botMessageTracker (= operador humano).
    // O operador pode enviar "bot" para desativar, ou expira após 30 minutos.
    if (conversation.humanMode && conversation.humanModeUntil) {
      const now = new Date();
      if (now < new Date(conversation.humanModeUntil)) {
        console.log(`[Chatbot] Modo humano ativo até ${new Date(conversation.humanModeUntil).toLocaleString('pt-BR')} — bot silencioso para ${phone}`);
        console.log(`[Chatbot] Operador pode enviar "bot" para reativar o atendimento automático.`);
        return; // Bot não responde enquanto o operador está no controle
      } else {
        // Expirou: desativar modo humano automaticamente
        await updateConversation(conversation.id, { humanMode: false, humanModeUntil: null });
        console.log(`[Chatbot] Modo humano expirado para ${phone} — bot retomando atendimento`);
      }
    }

    // 5. Verificar cache de FAQ antes de chamar o LLM (economia de tokens e latência)
    const faqResponse = checkFaqCache(messageText);
    if (faqResponse) {
      console.log(`[Chatbot] FAQ cache hit para ${phone}: "${messageText.slice(0, 50)}"`);
      // Salvar resposta do FAQ como mensagem do assistente
      await createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: faqResponse,
        messageType: "text",
        metadata: JSON.stringify({ source: "faq_cache" }),
      });
      // Enviar resposta via WhatsApp
      await whatsappService.sendText(whatsappId, faqResponse);
      return;
    }

    // 5b. Processar mensagem com IA usando o prompt completo do restaurante
    // Usar o número real do telefone (não o LID) para gerar links de pedido
    const response = await generateResponse(customer.id, conversation.id, messageText, context, normalizedPhone);

    // 6. Salvar resposta do assistente
    await createMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: response.text,
      messageType: "text",
      metadata: response.metadata ? JSON.stringify(response.metadata) : null,
    });

    // 7. Atualizar contexto da conversa
    if (response.updatedContext) {
      await updateConversation(conversation.id, {
        context: JSON.stringify(response.updatedContext),
        intent: response.updatedContext.intent || conversation.intent,
      });
    }

    // 7b. Detectar pedido de atendente humano e ativar modo humano IMEDIATAMENTE
    // SEGURANÇA: usar APENAS o marcador explícito [CHAMAR_ATENDENTE] gerado pelo LLM
    // (não keyword matching no texto — evita ativação acidental por palavras comuns como "atendente")
    const botRequestedHuman = response.text.includes("[CHAMAR_ATENDENTE]");

    if (botRequestedHuman) {
      try {
        // ATIVAR MODO HUMANO IMEDIATAMENTE (30 min)
        // O bot fica silencioso a partir de agora, sem esperar o operador responder
        const humanModeUntil = new Date(Date.now() + 30 * 60 * 1000);
        await updateConversation(conversation.id, {
          humanMode: true,
          humanModeUntil,
        });
        console.log(`[Chatbot] ✅ Modo humano ATIVADO PREVENTIVAMENTE para ${phone} até ${humanModeUntil.toISOString()}`);

        // Enviar alerta ao restaurante
        const settings = await getRestaurantSettings();
        const restaurantPhone = settings?.phone
          ? settings.phone.replace(/\D/g, "")
          : "5517982123269"; // fallback
        const restaurantPhoneNorm = restaurantPhone.startsWith("55")
          ? restaurantPhone
          : `55${restaurantPhone}`;

        const alertMsg =
          `🚨 *Atenção — Cliente aguardando atendimento humano!*\n\n` +
          `👤 *Cliente:* ${customer.name || phone}\n` +
          `📱 *Telefone:* ${phone}\n` +
          `💬 *Última mensagem:* "${messageText.substring(0, 100)}"\n\n` +
          `Responda diretamente para este contato no WhatsApp.\n` +
          `_O bot está pausado por 30 min. Envie #bot para reativar._`;

        await whatsappService.sendText(restaurantPhoneNorm, alertMsg).catch((err: unknown) => {
          logger.warn("Chatbot", "Falha ao enviar alerta de atendente para restaurante", err);
        });
        console.log(`[Chatbot] Alerta de atendimento humano enviado para ${restaurantPhoneNorm}`);
      } catch (err) {
        console.error("[Chatbot] Erro ao ativar modo humano preventivo:", err);
      }
    }

    // 8. Enviar resposta ao cliente
    // IMPORTANTE: usar o whatsappId original (pode ser @lid) para enviar mensagens,
    // pois a Evolution API precisa do JID correto para rotear a mensagem
    const useEvolution = !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);

    if (useEvolution) {
      // Se a resposta contiver um link de pedido, enviar como imagem com banner visual
      const orderLinkMatch = response.text.match(/https:\/\/[^\s]+\/pedido\/[a-f0-9]+/);
      if (orderLinkMatch) {
        const orderLink = orderLinkMatch[0];
        const textBeforeLink = response.text.split(orderLink)[0].trim();
        const textAfterLink = response.text.split(orderLink)[1]?.trim() || "";
        const caption = `${textBeforeLink}\n\n${orderLink}\n\n${textAfterLink}`.trim();

        const bannerUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663208695668/hEsNGYEonud5ngJEe9CdHq/banner_cardapio_digital_900x900_b8c4719c.png";
        const sent = await whatsappService.sendMedia(whatsappId, bannerUrl, caption);
        if (!sent) {
          // Fallback: enviar como texto simples se a imagem falhar
          await whatsappService.sendText(whatsappId, response.text);
        }
      } else {
        await whatsappService.sendText(whatsappId, response.text);
      }
    } else if (response.buttons) {
      await sendButtonMessage(phone, response.text, response.buttons);
    } else if (response.list) {
      await sendListMessage(phone, response.text, response.list.buttonText, response.list.sections);
    } else {
      await whatsappService.sendText(whatsappId, response.text);
    }
  } catch (error) {
    console.error("[Chatbot] Error processing message:", error);
    await whatsappService.sendText(whatsappId, "Desculpe, ocorreu um erro. Por favor, tente novamente.").catch((sendErr: unknown) => {
      logger.warn("Chatbot", "Falha ao enviar mensagem de erro ao cliente", sendErr);
    });
  }
}

interface BotResponse {
  text: string;
  updatedContext?: ChatContext;
  buttons?: Array<{ id: string; title: string }>;
  list?: {
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Gera resposta usando IA com o prompt completo do restaurante (chatbotPrompt.ts)
 * Processa [GERAR_LINK_PEDIDO] substituindo pelo link real do cardápio digital
 */
async function generateResponse(
  customerId: number,
  conversationId: number,
  userMessage: string,
  context: ChatContext,
  phone: string
): Promise<BotResponse> {
  // Obter data/hora atual para contexto (fuso Brasília UTC-3)
  const hoje = new Date();
  const tzBrasilia = 'America/Sao_Paulo';
  const diaSemana = hoje.toLocaleDateString("pt-BR", { weekday: "long", timeZone: tzBrasilia });
  const dataCompleta = hoje.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: tzBrasilia,
  });
  const horarioAtual = hoje.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tzBrasilia,
  });

  // Usar o prompt COMPLETO do restaurante
  const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

  // Buscar e construir bloco de contexto do cliente (pedidos recentes + reservas ativas)
  const customerContextBlock = await buildCustomerContextBlock(customerId);

  // Obter hist\u00f3rico de mensagens (30 mensagens para contexto mais amplo)
  const history = await getConversationMessages(conversationId, 30);
  // getConversationMessages retorna DESC, precisamos reverter para ordem cronol\u00f3gica
  history.reverse();

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt + customerContextBlock },
  ];

  // Adicionar hist\u00f3rico (\u00faltimas 30 mensagens para mais contexto e reten\u00e7\u00e3o de mem\u00f3ria)
  // IMPORTANTE: remover links de pedido do hist\u00f3rico para for\u00e7ar a IA a sempre usar [GERAR_LINK_PEDIDO]
  // Isso garante que cada pedido gere um link novo, mesmo que o cliente pe\u00e7a v\u00e1rias vezes
  const recentHistory = history.slice(-30);
  for (const msg of recentHistory) {
    let content = msg.content;
    // Substituir links de pedido por [GERAR_LINK_PEDIDO] no histórico do assistente
    if (msg.role === "assistant") {
      content = content.replace(/https?:\/\/[^\s]+\/pedido\/[a-f0-9]+/g, "[GERAR_LINK_PEDIDO]");
    }
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content,
    });
  }

  // Adicionar mensagem atual
  messages.push({
    role: "user",
    content: userMessage,
  });

  // Chamar IA
  let response: Awaited<ReturnType<typeof invokeLLM>>;
  try {
    response = await invokeLLM({ messages });
  } catch (llmError) {
    logger.error("Chatbot", "Falha ao chamar invokeLLM", llmError);
    return {
      text: "Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em instantes ou ligue para o restaurante. 🙏",
    };
  }

  const aiContent = response.choices[0]?.message?.content;
  let aiResponse = typeof aiContent === "string"
    ? aiContent
    : Array.isArray(aiContent)
      ? (aiContent.find((c: any) => c.type === "text") as any)?.text || "Desculpe, não entendi. Pode reformular?"
      : "Desculpe, não entendi. Pode reformular?";

  // Processar ações especiais do LLM usando o chatbotActionHandler
  aiResponse = await handleOrderLink(aiResponse, phone);
  aiResponse = await handleOrderStatus(aiResponse);
  aiResponse = await handleSaveReservation(aiResponse, phone);

  // Detectar intenção para atualizar contexto
  const updatedContext = detectIntent(userMessage, context);

  // Sanitizar output do LLM antes de enviar
  aiResponse = sanitizeLLMOutput(aiResponse);

  return {
    text: aiResponse,
    updatedContext,
  };
}

/**
 * Detecta a intenção do usuário e atualiza o contexto
 */
function detectIntent(userMessage: string, currentContext: ChatContext): ChatContext {
  const lowerMessage = userMessage.toLowerCase();
  const updatedContext = { ...currentContext };

  if (
    lowerMessage.includes("pedido") ||
    lowerMessage.includes("pedir") ||
    lowerMessage.includes("delivery") ||
    lowerMessage.includes("cardápio") ||
    lowerMessage.includes("quero")
  ) {
    updatedContext.intent = "order";
  } else if (
    lowerMessage.includes("reserva") ||
    lowerMessage.includes("reservar") ||
    lowerMessage.includes("mesa")
  ) {
    updatedContext.intent = "reservation";
  } else if (
    lowerMessage.includes("feedback") ||
    lowerMessage.includes("avaliação") ||
    lowerMessage.includes("reclamação") ||
    lowerMessage.includes("elogio")
  ) {
    updatedContext.intent = "feedback";
  } else if (
    lowerMessage.includes("horário") ||
    lowerMessage.includes("endereço") ||
    lowerMessage.includes("localização") ||
    lowerMessage.includes("telefone") ||
    lowerMessage.includes("pagamento")
  ) {
    updatedContext.intent = "info";
  }

  return updatedContext;
}

/**
 * Processa seleção de item do menu
 */
export async function processMenuSelection(
  customerId: number,
  conversationId: number,
  itemId: number,
  quantity: number = 1
): Promise<void> {
  const conversation = await getActiveConversation(customerId);
  if (!conversation) return;

  const context: ChatContext = conversation.context ? JSON.parse(conversation.context) : {};

  if (!context.orderItems) {
    context.orderItems = [];
  }

  const existingIndex = context.orderItems.findIndex((i) => i.itemId === itemId);
  if (existingIndex >= 0) {
    context.orderItems[existingIndex]!.quantity += quantity;
  } else {
    context.orderItems.push({ itemId, quantity });
  }

  await updateConversation(conversation.id, {
    context: JSON.stringify(context),
  });
}
