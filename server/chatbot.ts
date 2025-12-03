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
} from "./db";
import { sendTextMessage, sendButtonMessage, sendListMessage } from "./whatsapp";

interface ChatContext {
  intent?: "order" | "reservation" | "info" | "feedback" | "other";
  orderItems?: Array<{ itemId: number; quantity: number; notes?: string }>;
  deliveryAddress?: string;
  reservationDate?: string;
  reservationPeople?: number;
  awaitingInput?: string; // O que estamos esperando do usuário
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

    // 5. Processar mensagem com IA
    const response = await generateResponse(customer.id, conversation.id, messageText, context);

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
    if (response.buttons) {
      await sendButtonMessage(phone, response.text, response.buttons);
    } else if (response.list) {
      await sendListMessage(phone, response.text, response.list.buttonText, response.list.sections);
    } else {
      await sendTextMessage(phone, response.text);
    }
  } catch (error) {
    console.error("[Chatbot] Error processing message:", error);
    await sendTextMessage(phone, "Desculpe, ocorreu um erro. Por favor, tente novamente.");
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
 * Gera resposta usando IA baseada no histórico e contexto
 */
async function generateResponse(
  customerId: number,
  conversationId: number,
  userMessage: string,
  context: ChatContext
): Promise<BotResponse> {
  // Obter informações do restaurante
  const settings = await getRestaurantSettings();
  const categories = await getMenuCategories();
  const menuItems = await getMenuItems();

  // Construir informações do restaurante para o sistema
  const restaurantInfo = settings
    ? `
Nome: ${settings.name}
Telefone: ${settings.phone}
Endereço: ${settings.address}
Horário: ${settings.openingHours}
Aceita Delivery: ${settings.acceptsDelivery ? "Sim" : "Não"}
Aceita Reservas: ${settings.acceptsReservation ? "Sim" : "Não"}
Taxa de Entrega: R$ ${(settings.deliveryFee / 100).toFixed(2)}
Pedido Mínimo: R$ ${(settings.minimumOrder / 100).toFixed(2)}
Formas de Pagamento: ${settings.paymentMethods}
`
    : "Informações do restaurante não configuradas.";

  const menuInfo = menuItems.length > 0
    ? `
Cardápio:
${menuItems.map((item) => `- ${item.name}: R$ ${(item.price / 100).toFixed(2)} ${item.description ? `(${item.description})` : ""}`).join("\n")}
`
    : "Cardápio não disponível.";

  // Obter histórico de mensagens
  const history = await getMessagesByConversation(conversationId);
  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `Você é um assistente virtual inteligente de um restaurante. Seu objetivo é ajudar os clientes com:
1. Pedidos de delivery ou retirada
2. Reservas de mesa
3. Informações sobre o restaurante (horário, localização, cardápio, etc)
4. Coleta de feedback

Informações do Restaurante:
${restaurantInfo}

${menuInfo}

Contexto atual da conversa: ${JSON.stringify(context)}

Instruções:
- Seja cordial, prestativo e profissional
- Responda de forma clara e objetiva
- Quando o cliente quiser fazer um pedido, mostre o cardápio e ajude na seleção
- Para reservas, pergunte data, horário e número de pessoas
- Sempre confirme os detalhes antes de finalizar pedidos ou reservas
- Use emojis moderadamente para deixar a conversa mais amigável
- Mantenha respostas curtas (máximo 300 caracteres quando possível)`,
    },
  ];

  // Adicionar histórico (últimas 10 mensagens)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: [{ type: "text" as const, text: msg.content }],
    });
  }

  // Adicionar mensagem atual
  messages.push({
    role: "user",
    content: [{ type: "text" as const, text: userMessage }],
  });

  // Chamar IA
  const response = await invokeLLM({
    messages,
  });

  const aiContent = response.choices[0]?.message?.content;
  const aiResponse = typeof aiContent === "string" 
    ? aiContent 
    : Array.isArray(aiContent) 
      ? aiContent.find(c => c.type === "text")?.text || "Desculpe, não entendi. Pode reformular?"
      : "Desculpe, não entendi. Pode reformular?";

  // Detectar intenção e atualizar contexto
  const updatedContext = await detectIntentAndUpdateContext(userMessage, aiResponse, context, menuItems);

  // Preparar resposta com botões ou listas se apropriado
  const botResponse: BotResponse = {
    text: aiResponse,
    updatedContext,
  };

  // Se detectou intenção de pedido e não tem itens ainda, mostrar cardápio
  if (updatedContext.intent === "order" && (!updatedContext.orderItems || updatedContext.orderItems.length === 0)) {
    if (categories.length > 0) {
      botResponse.list = {
        buttonText: "Ver Cardápio",
        sections: await buildMenuSections(),
      };
    }
  }

  // Se detectou intenção de informação geral, oferecer opções
  if (updatedContext.intent === "info") {
    botResponse.buttons = [
      { id: "info_hours", title: "Horário" },
      { id: "info_location", title: "Localização" },
      { id: "info_payment", title: "Pagamento" },
    ];
  }

  return botResponse;
}

/**
 * Detecta a intenção do usuário e atualiza o contexto
 */
async function detectIntentAndUpdateContext(
  userMessage: string,
  aiResponse: string,
  currentContext: ChatContext,
  menuItems: ReturnType<typeof getMenuItems> extends Promise<infer T> ? T : never
): Promise<ChatContext> {
  const lowerMessage = userMessage.toLowerCase();
  const updatedContext = { ...currentContext };

  // Detectar intenção
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
 * Constrói seções do menu para lista interativa
 */
async function buildMenuSections() {
  const categories = await getMenuCategories();
  const sections = [];

  for (const category of categories) {
    const items = await getMenuItems(category.id);
    if (items.length > 0) {
      sections.push({
        title: category.name,
        rows: items.slice(0, 10).map((item) => ({
          id: `item_${item.id}`,
          title: item.name.substring(0, 24),
          description: `R$ ${(item.price / 100).toFixed(2)}`,
        })),
      });
    }
  }

  return sections;
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

  // Adicionar ou atualizar item
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
