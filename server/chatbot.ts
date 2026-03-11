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
import { orderSessions } from "../drizzle/schema";
import { randomBytes } from "crypto";
// URL de produção hardcoded — não depende de variáveis de ambiente
// chatbotwa-hesngyeo.manus.space é o domínio publicado correto
const SITE_URL = process.env.NODE_ENV === "production"
  ? "https://chatbotwa-hesngyeo.manus.space"
  : (process.env.SITE_DEV_URL || "http://localhost:3000");

interface ChatContext {
  intent?: "order" | "reservation" | "info" | "feedback" | "other";
  orderItems?: Array<{ itemId: number; quantity: number; notes?: string }>;
  deliveryAddress?: string;
  reservationDate?: string;
  reservationPeople?: number;
  awaitingInput?: string;
}

/**
 * Processa uma mensagem recebida do cliente via WhatsApp
 */
export async function processIncomingMessage(
  whatsappId: string,
  phone: string,
  messageText: string,
  messageId: string
): Promise<void> {
  try {
    // 1. Buscar ou criar cliente
    let customer = await getCustomerByWhatsappId(whatsappId);
    if (!customer) {
      customer = await createCustomer({
        whatsappId,
        phone,
        name: null,
        address: null,
      });
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

    // 5. Processar mensagem com IA usando o prompt completo do restaurante
    const response = await generateResponse(customer.id, conversation.id, messageText, context, phone);

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

    // 8. Enviar resposta ao cliente
    // Usar Evolution API se configurada, caso contrário usar Meta Cloud API
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
        const bannerUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663208695668/hEsNGYEonud5ngJEe9CdHq/banner-cardapio-whatsapp-M8mMSXByvpQzK6jG7HNoeV.png";
        const sent = await sendMediaMessageEvolution(phone, bannerUrl, caption);
        if (!sent) {
          // Fallback: enviar como texto simples se a imagem falhar
          await sendTextMessageEvolution(phone, response.text);
        }
      } else {
        await sendTextMessageEvolution(phone, response.text);
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
      await sendTextMessageEvolution(phone, "Desculpe, ocorreu um erro. Por favor, tente novamente.");
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
  const recentHistory = history.slice(-15);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
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

  // Detectar intenção para atualizar contexto
  const updatedContext = detectIntent(userMessage, context);

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
