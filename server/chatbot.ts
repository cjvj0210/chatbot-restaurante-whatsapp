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
} from "./db";
import { sendTextMessage, sendButtonMessage, sendListMessage } from "./whatsapp";
import { sendTextMessageEvolution, sendMediaMessageEvolution } from "./evolutionApi";
import { getChatbotPrompt } from "./chatbotPrompt";
import { orderSessions, orders, reservations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { notifyOwner } from "./_core/notification";
import { sanitizeLLMOutput } from "./sanitize";
import { checkChatbotRateLimit } from "./chatbotRateLimit";
import { checkFaqCache } from "./faqCache";
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

/**
 * Deduplicação robusta de mensagens no processIncomingMessage.
 * Última barreira para evitar respostas duplicadas quando webhook e polling
 * processam a mesma mensagem, ou quando a Evolution API envia múltiplos
 * eventos MESSAGES_UPSERT para a mesma mensagem.
 */
const recentlyProcessedMessages = new Map<string, number>(); // messageId -> timestamp
const DEDUP_WINDOW_MS = 60_000; // 60 segundos
const MAX_DEDUP_ENTRIES = 1000;

function isDuplicateMessage(messageId: string): boolean {
  // Limpar entradas antigas periodicamente
  if (recentlyProcessedMessages.size > MAX_DEDUP_ENTRIES) {
    const now = Date.now();
    Array.from(recentlyProcessedMessages.entries()).forEach(([id, ts]) => {
      if (now - ts > DEDUP_WINDOW_MS) {
        recentlyProcessedMessages.delete(id);
      }
    });
  }

  if (recentlyProcessedMessages.has(messageId)) {
    return true; // Já processada
  }

  recentlyProcessedMessages.set(messageId, Date.now());
  return false; // Primeira vez
}

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
  // ===== DEDUPLICAÇÃO: Última barreira contra respostas duplicadas =====
  // Evita que webhook + polling, ou múltiplos eventos MESSAGES_UPSERT,
  // processem a mesma mensagem mais de uma vez.
  if (isDuplicateMessage(messageId)) {
    console.log(`[Chatbot] ⚠️ Mensagem duplicada ignorada: ${messageId} (de ${phone})`);
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
    if (!checkChatbotRateLimit(whatsappId)) {
      console.warn(`[Chatbot] Rate limit atingido para ${phone} (${whatsappId})`);
      const useEvo = !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
      const limitMsg = "Você enviou muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente, ou ligue para nosso telefone fixo. 😊";
      if (useEvo) {
        await sendTextMessageEvolution(whatsappId, limitMsg);
      } else {
        await sendTextMessage(phone, limitMsg);
      }
      return;
    }

    // Guardrail: limitar tamanho da mensagem para evitar abuso de LLM e prompt injection
    const MAX_MSG_LENGTH = 2000;
    if (messageText.length > MAX_MSG_LENGTH) {
      console.warn(`[Chatbot] Mensagem muito longa (${messageText.length} chars) de ${phone} — truncando`);
      messageText = messageText.slice(0, MAX_MSG_LENGTH) + "...";
    }

    // Guardrail: sanitizar tentativas óbvias de prompt injection
    // Remover instruções que tentam redefinir o papel do bot
    const injectionPatterns = [
      /ignore (all )?(previous|prior|above) instructions?/gi,
      /you are now/gi,
      /act as (a |an )?/gi,
      /forget (everything|your instructions)/gi,
      /\[system\]/gi,
      /\[assistant\]/gi,
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
      const useEvo = !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
      if (useEvo) {
        await sendTextMessageEvolution(whatsappId, faqResponse);
      } else {
        await sendTextMessage(phone, faqResponse);
      }
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

    // 7b. Detectar pedido de atendente humano e enviar alerta interno
    const humanKeywords = [
      "atendente", "humano", "pessoa", "falar com alguém", "falar com um humano",
      "quero falar com", "preciso falar com", "chamar alguém", "operador",
      "atendimento humano", "falar com atendente"
    ];
    const isAskingForHuman = humanKeywords.some(kw =>
      messageText.toLowerCase().includes(kw)
    );

    if (isAskingForHuman) {
      try {
        // Buscar número do restaurante nas configurações
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
          `Acesse o WhatsApp e responda diretamente para este contato.\n` +
          `_O bot ficará silencioso por 30 minutos após você responder._`;

        await sendTextMessageEvolution(restaurantPhoneNorm, alertMsg).catch(() => {});
        console.log(`[Chatbot] Alerta de atendimento humano enviado para ${restaurantPhoneNorm}`);
      } catch (err) {
        console.error("[Chatbot] Erro ao enviar alerta de atendimento humano:", err);
      }
    }

    // 8. Enviar resposta ao cliente
    // Usar Evolution API se configurada, caso contrário usar Meta Cloud API
    // IMPORTANTE: usar o whatsappId original (pode ser @lid) para enviar mensagens,
    // pois a Evolution API precisa do JID correto para rotear a mensagem
    const useEvolution = !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
    
    if (useEvolution) {
      // Se a resposta contiver um link de pedido, enviar como imagem com banner visual
      const orderLinkMatch = response.text.match(/https:\/\/[^\s]+\/pedido\/[a-f0-9]+/);
      if (orderLinkMatch) {
        const orderLink = orderLinkMatch[0];
        // Extrair texto antes e depois do link para a legenda
        const textBeforeLink = response.text.split(orderLink)[0].trim();
        const textAfterLink = response.text.split(orderLink)[1]?.trim() || "";
        const caption = `${textBeforeLink}\n\n${orderLink}\n\n${textAfterLink}`.trim();
        
        // Enviar banner visual com o link embutido na legenda
        const bannerUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663208695668/hEsNGYEonud5ngJEe9CdHq/banner_cardapio_digital_900x900_b8c4719c.png";
        const sent = await sendMediaMessageEvolution(whatsappId, bannerUrl, caption);
        if (!sent) {
          // Fallback: enviar como texto simples se a imagem falhar
          await sendTextMessageEvolution(whatsappId, response.text);
        }
      } else {
        await sendTextMessageEvolution(whatsappId, response.text);
      }
    } else if (response.buttons) {
      await sendButtonMessage(phone, response.text, response.buttons);
    } else if (response.list) {
      await sendListMessage(phone, response.text, response.list.buttonText, response.list.sections);
    } else {
      await sendTextMessage(phone, response.text);
    }
  } catch (error) {
    console.error("[Chatbot] Error processing message:", error);
    const useEvolution = !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
    if (useEvolution) {
      await sendTextMessageEvolution(whatsappId, "Desculpe, ocorreu um erro. Por favor, tente novamente.");
    } else {
      await sendTextMessage(phone, "Desculpe, ocorreu um erro. Por favor, tente novamente.");
    }
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

  // Obter histórico de mensagens
  const history = await getMessagesByConversation(conversationId);

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Adicionar histórico (últimas 15 mensagens para mais contexto)
  // IMPORTANTE: remover links de pedido do histórico para forçar a IA a sempre usar [GERAR_LINK_PEDIDO]
  // Isso garante que cada pedido gere um link novo, mesmo que o cliente peça várias vezes
  const recentHistory = history.slice(-15);
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
  const response = await invokeLLM({ messages });

  const aiContent = response.choices[0]?.message?.content;
  let aiResponse = typeof aiContent === "string"
    ? aiContent
    : Array.isArray(aiContent)
      ? (aiContent.find((c: any) => c.type === "text") as any)?.text || "Desculpe, não entendi. Pode reformular?"
      : "Desculpe, não entendi. Pode reformular?";

  // Processar [GERAR_LINK_PEDIDO] — criar sessão e substituir pelo link real
  if (aiResponse.includes("[GERAR_LINK_PEDIDO]")) {
    try {
      const db = await getDb();
      if (db) {
        const sessionId = randomBytes(16).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.insert(orderSessions).values({
          sessionId,
          whatsappNumber: phone,
          customerId: null,
          status: "pending",
          expiresAt,
        });
        const orderLink = `${SITE_URL}/pedido/${sessionId}`;
        // Garante que o link fique em linha isolada (iOS exige URL sozinha na linha para ser clicavel)
        aiResponse = aiResponse.replace(/\[GERAR_LINK_PEDIDO\]/g, `\n${orderLink}\n`);
        aiResponse = aiResponse.replace(/\n{3,}/g, '\n\n');
        console.log(`[Chatbot] Link de pedido gerado para ${phone}: ${orderLink}`);
      } else {
        aiResponse = aiResponse.replace(/\[GERAR_LINK_PEDIDO\]/g, "(link temporariamente indisponível)");
      }
    } catch (err) {
      console.error("[Chatbot] Erro ao gerar link de pedido:", err);
      aiResponse = aiResponse.replace(/\[GERAR_LINK_PEDIDO\]/g, "(link temporariamente indisponível)");
    }
  }

  // Processar [VERIFICAR_STATUS_PEDIDO:PEDXXXXXXXX] — buscar status real do pedido no banco
  const statusMatch = aiResponse.match(/\[VERIFICAR_STATUS_PEDIDO:([A-Z0-9]+)\]/);
  if (statusMatch) {
    const orderNum = statusMatch[1];
    try {
      const db = await getDb();
      if (db) {
        const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNum)).limit(1);
        if (order) {
          const statusMap: Record<string, string> = {
            pending: "⏳ Aguardando aceite do restaurante",
            confirmed: "✅ Pedido confirmado — em preparação",
            preparing: "👨\u200d🍳 Em preparação na cozinha",
            ready: "✅ Pronto! Aguardando entregador",
            delivering: "🛵 Saiu para entrega!",
            delivered: "✅ Entregue com sucesso!",
            cancelled: "❌ Pedido cancelado",
          };
          const statusText = statusMap[order.status] || order.status;
          const tipoEntrega = order.orderType === 'pickup' ? 'Retirada no balcão' : `Delivery — ${order.deliveryAddress || 'endereço não informado'}`;
          const totalVal = `R$ ${((order.total || 0) / 100).toFixed(2).replace('.', ',')}`;

          // Calcular previsão de entrega baseada no horário de confirmação
          let previsaoMsg = '';
          if ((order.status === 'confirmed' || order.status === 'preparing' || order.status === 'delivering') && (order as any).confirmedAt) {
            const confirmedAt = new Date((order as any).confirmedAt);
            const now = new Date();
            const minutesElapsed = Math.floor((now.getTime() - confirmedAt.getTime()) / 60000);
            const dayOfWeek = confirmedAt.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (order.orderType === 'delivery') {
              const minTime = isWeekend ? 60 : 45;
              const maxTime = isWeekend ? 110 : 70;
              const minRemaining = Math.max(0, minTime - minutesElapsed);
              const maxRemaining = Math.max(0, maxTime - minutesElapsed);
              if (minutesElapsed < minTime) {
                previsaoMsg = `\n⏱️ *Previsão de entrega:* ${minRemaining} a ${maxRemaining} min restantes`;
              } else if (minutesElapsed <= maxTime) {
                previsaoMsg = `\n⏱️ *Previsão de entrega:* chegando em breve!`;
              } else {
                previsaoMsg = `\n⏱️ *Previsão:* já deveria ter chegado — qualquer dúvida fale conosco!`;
              }
            } else {
              const minTime = 30;
              const maxTime = 50;
              const minRemaining = Math.max(0, minTime - minutesElapsed);
              const maxRemaining = Math.max(0, maxTime - minutesElapsed);
              if (minutesElapsed < minTime) {
                previsaoMsg = `\n⏱️ *Previsão para retirada:* ${minRemaining} a ${maxRemaining} min restantes`;
              } else if (minutesElapsed <= maxTime) {
                previsaoMsg = `\n⏱️ *Previsão:* seu pedido já deve estar pronto!`;
              } else {
                previsaoMsg = `\n⏱️ *Previsão:* já deve estar pronto — pode vir retirar!`;
              }
            }
          }

          const statusMsg = `📦 *Pedido ${orderNum}*\nStatus: ${statusText}\n${tipoEntrega}\nTotal: ${totalVal}${previsaoMsg}`;
          aiResponse = aiResponse.replace(statusMatch[0], statusMsg);
        } else {
          aiResponse = aiResponse.replace(statusMatch[0], `Não encontrei o pedido *${orderNum}*. Verifique o número e tente novamente.`);
        }
      } else {
        aiResponse = aiResponse.replace(statusMatch[0], "Sistema temporariamente indisponível. Tente novamente em instantes.");
      }
    } catch (err) {
      console.error("[Chatbot] Erro ao verificar status do pedido:", err);
      aiResponse = aiResponse.replace(statusMatch[0], "Não consegui verificar o status agora. Tente novamente em instantes.");
    }
  }

  // Processar [SALVAR_RESERVA:...] — salvar reserva no banco e remover marcador da mensagem
  const reservaRegex = /\[SALVAR_RESERVA:([^\]]+)\]/;
  const reservaMatch = aiResponse.match(reservaRegex);
  if (reservaMatch) {
    try {
      const params: Record<string, string> = {};
      reservaMatch[1]!.split(';').forEach((pair: string) => {
        const [key, ...rest] = pair.split('=');
        if (key) params[key.trim()] = rest.join('=').trim();
      });

      const db = await getDb();
      if (db) {
        const dateStr = new Date().toISOString().slice(0, 8).replace(/-/g, '');
        const suffix = randomBytes(2).toString('hex').toUpperCase();
        const reservationNumber = `RES-${dateStr}-${suffix}`;

        // Parsear data da reserva
        let reservationDate = new Date();
        try {
          if (params.data) {
            // Formato esperado: DD/MM/YYYY HH:MM
            const match = params.data.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
            if (match) {
              const [, day, month, year, hour, min] = match;
              reservationDate = new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!), parseInt(hour!), parseInt(min!));
            } else {
              const parsed = new Date(params.data);
              if (!isNaN(parsed.getTime())) reservationDate = parsed;
            }
          }
        } catch {}

        const customerPhone = params.telefone || phone;

        await db.insert(reservations).values({
          customerId: null,
          reservationNumber,
          customerName: params.nome || 'Cliente via WhatsApp',
          customerPhone,
          date: reservationDate,
          numberOfPeople: parseInt(params.pessoas || '1', 10),
          customerNotes: params.obs && params.obs !== 'OBSERVACOES' && params.obs.trim() ? params.obs : null,
          status: 'pending',
          source: 'chatbot',
        });

        console.log(`[Chatbot] Reserva salva: ${reservationNumber} para ${params.nome} em ${reservationDate.toISOString()}`);

        // Notificar o dono via sistema
        await notifyOwner({
          title: `📅 Nova reserva via WhatsApp`,
          content: `Nome: ${params.nome || '-'}\nTelefone: ${customerPhone}\nData/Hora: ${params.data || '-'}\nPessoas: ${params.pessoas || '-'}\nObs: ${params.obs && params.obs !== 'OBSERVACOES' ? params.obs : '-'}`,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Chatbot] Erro ao salvar reserva:', err);
    }

    // Remover o marcador da mensagem enviada ao cliente
    aiResponse = aiResponse.replace(reservaRegex, '').replace(/\n{3,}/g, '\n\n').trim();
  }

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
