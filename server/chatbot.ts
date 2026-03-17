import { invokeLLM } from "./_core/llm";
import type { Message as LLMMessage } from "./_core/llm";
import {
  getRestaurantSettings,
  getCustomerByWhatsappId,
  createCustomer,
  createCustomerWithConversation,
  updateCustomer,
  getActiveConversation,
  getActiveConversationByWhatsappId,
  createConversation,
  createMessage,
  updateConversation,
  getDb,
  tryClaimMessage,
  getConversationMessages,
} from "./db";
import { sendTextMessage } from "./whatsapp";
import { whatsappService } from "./services/whatsappService";
import { buildCustomerContextBlock } from "./services/customerContextBuilder";
import { handleOrderLink, handleOrderStatus, handleSaveReservation } from "./services/chatbotActionHandler";
import { getChatbotPrompt } from "./chatbotPrompt";
import { getBRTDateTimeFormatted } from "../shared/businessHours";
import { conversations } from "../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { sanitizeLLMOutput } from "./sanitize";
import { checkChatbotRateLimit } from "./chatbotRateLimit";
import { checkFaqCache } from "./faqCache";
import { logger } from "./utils/logger";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { getAffectedRows } from "./utils/dbHelpers";
import { CHATBOT } from "../shared/constants";
import { withRetry } from "./utils/retry";

interface ChatContext {
  intent?: "order" | "reservation" | "info" | "feedback" | "other";
  orderItems?: Array<{ itemId: number; quantity: number; notes?: string }>;
  deliveryAddress?: string;
  reservationDate?: string;
  reservationPeople?: number;
  awaitingInput?: string;
}

// ===== CACHE EM MEMÓRIA DO MODO HUMANO =====
// Camada extra de proteção: mesmo se o lookup do banco falhar por JID inconsistente,
// o cache garante que o bot fique silencioso pelo tempo correto.
// Chave: phone normalizado (apenas dígitos). Valor: timestamp de expiração.
const humanModeCache = new Map<string, number>();

/** Ativa o modo humano no cache em memória */
export function setHumanModeCache(phone: string, expiresAt: number): void {
  const key = phone.replace(/\D/g, "").slice(-11); // Últimos 11 dígitos
  humanModeCache.set(key, expiresAt);
  logger.info("HumanModeCache", `Modo humano cacheado para ${key} até ${new Date(expiresAt).toISOString()}`);
}

/** Desativa o modo humano no cache em memória */
export function clearHumanModeCache(phone: string): void {
  const key = phone.replace(/\D/g, "").slice(-11);
  humanModeCache.delete(key);
  logger.info("HumanModeCache", `Modo humano removido do cache para ${key}`);
}

/** Verifica se o modo humano está ativo no cache em memória */
function isHumanModeCached(phone: string): boolean {
  const key = phone.replace(/\D/g, "").slice(-11);
  const expiresAt = humanModeCache.get(key);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    humanModeCache.delete(key);
    return false;
  }
  return true;
}

// Limpeza periódica do cache (a cada 5 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of Array.from(humanModeCache.entries())) {
    if (now > expiresAt) humanModeCache.delete(key);
  }
}, 5 * 60 * 1000);

/** Fields that can be updated on an existing customer record */
interface CustomerUpdates {
  name?: string;
  whatsappId?: string;
  phone?: string;
}

// A deduplicação agora é feita via banco de dados (tryClaimMessage)
// para funcionar entre múltiplas instâncias do servidor (dev + produção).

/**
 * Verifica e expira o modo humano de forma atômica via UPDATE condicional no banco.
 * Evita race condition onde duas instâncias leem humanMode=true simultaneamente.
 * @returns true se ainda está em modo humano, false se expirou ou não estava ativo
 */
async function checkAndExpireHumanMode(conversationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // UPDATE atômico: expira somente se humanModeUntil já passou
  const result = await db.update(conversations)
    .set({ humanMode: false, humanModeUntil: null })
    .where(and(
      eq(conversations.id, conversationId),
      eq(conversations.humanMode, true),
      lt(conversations.humanModeUntil, new Date())
    ));

  // Se atualizou alguma linha, acabou de expirar agora → bot pode responder
  if (getAffectedRows(result) > 0) return false;

  // Caso contrário, verificar o estado atual
  const [conv] = await db
    .select({ humanMode: conversations.humanMode })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return conv?.humanMode ?? false;
}

/**
 * Lock por whatsappId para evitar processamento concorrente de múltiplas
 * mensagens do mesmo cliente (evita race conditions no LLM/DB).
 */
const processingLocks = new Map<string, Promise<void>>();
// Timeout máximo de espera no lock — maior que o timeout do LLM (60s) + margem
const LOCK_TIMEOUT_MS = 90_000;

async function withClientLock(whatsappId: string, operation: () => Promise<void>): Promise<void> {
  // Esperar qualquer processamento anterior do mesmo cliente terminar
  // Com timeout para evitar vazamento de memória se LLM demorar indefinidamente
  const existing = processingLocks.get(whatsappId);
  if (existing) {
    await Promise.race([
      existing,
      new Promise<void>((resolve) => setTimeout(resolve, LOCK_TIMEOUT_MS)),
    ]);
  }

  const promise = operation();
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
    logger.info("Chatbot", `⚠️ Mensagem já processada por outra instância: ${messageId} (de ${phone})`);
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
 * Sanitiza e valida o texto da mensagem recebida.
 * Aplica dois guardrails: truncamento de mensagens longas e filtragem de prompt injection.
 *
 * @param messageText - Texto original da mensagem
 * @param phone - Número do remetente (para log)
 * @returns Texto sanitizado (pode ser modificado ou truncado)
 */
function sanitizeAndValidateMessage(messageText: string, phone: string): string {
  // Guardrail: limitar tamanho da mensagem para evitar abuso de LLM e prompt injection
  if (messageText.length > CHATBOT.MAX_MESSAGE_LENGTH) {
    logger.warn("Chatbot", `Mensagem muito longa (${messageText.length} chars) de ${phone} — truncando`);
    messageText = messageText.slice(0, CHATBOT.MAX_MESSAGE_LENGTH) + "...";
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
      logger.warn("Chatbot", `Possível prompt injection detectado de ${phone}: ${messageText.slice(0, 100)}`);
      messageText = messageText.replace(pattern, "[mensagem filtrada]");
    }
  }

  return messageText;
}

/**
 * Busca ou cria o registro de cliente e conversa ativa para o JID recebido.
 * Atualiza dados cadastrais (name, whatsappId canônico, phone) se estiverem desatualizados.
 *
 * @param whatsappId - JID completo (pode ser @lid ou @s.whatsapp.net)
 * @param normalizedPhone - Número real normalizado (apenas dígitos)
 * @param messageId - ID da mensagem (usado ao criar nova conversa)
 * @param pushName - Nome do contato no WhatsApp (opcional)
 * @param realPhone - Número real quando JID é @lid (extraído de remoteJidAlt)
 * @returns `{ customer, conversation }` — ambos garantidos (nunca null)
 */
async function findOrCreateCustomerAndConversation(
  whatsappId: string,
  normalizedPhone: string,
  messageId: string,
  pushName?: string,
  realPhone?: string
) {
  // Buscar ou criar cliente
  let customer = await getCustomerByWhatsappId(whatsappId, realPhone);
  if (!customer) {
    // Se temos o número real (via remoteJidAlt), usar ele como whatsappId canônico
    const canonicalWhatsappId = realPhone
      ? phoneNormalizer.toJid(realPhone)
      : whatsappId;
    // DB-2: criar cliente + conversa em uma transação atômica para evitar
    // clientes órfãos (sem conversa) em caso de falha entre os dois inserts.
    const created = await createCustomerWithConversation(
      {
        whatsappId: canonicalWhatsappId,
        phone: normalizedPhone,
        name: pushName || null,
        address: null,
      },
      {
        whatsappMessageId: messageId,
        intent: null,
        context: JSON.stringify({}),
        isActive: true,
      }
    );
    return created;
  }

  // Cliente existente: atualizar dados se estiverem faltando ou desatualizados
  const updates: CustomerUpdates = {};
  if (!customer.name && pushName) {
    updates.name = pushName;
  }
  // Se o whatsappId atual é @lid mas temos o número real, migrar para o formato canônico
  if (realPhone && customer.whatsappId.endsWith("@lid")) {
    updates.whatsappId = phoneNormalizer.toJid(realPhone);
    updates.phone = normalizedPhone;
  }
  // Se o phone está com o LID (muito longo), substituir pelo número real
  if (realPhone && customer.phone && customer.phone.length > 13) {
    updates.phone = normalizedPhone;
  }
  if (Object.keys(updates).length > 0) {
    try {
      await updateCustomer(customer.id, updates);
      Object.assign(customer, updates);
      logger.info("Chatbot", `Cliente ${customer.id} atualizado: ${Object.keys(updates).join(", ")}`);
    } catch (err) {
      logger.error("Chatbot", "Erro ao atualizar cliente", err);
    }
  }

  // Buscar ou criar conversa ativa
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

  return { customer, conversation };
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
    // Verificar disponibilidade do banco antecipadamente para degradação graciosa
    const db = await getDb();
    const dbAvailable = db !== null;

    // Guardrail: rate limit por whatsappId (máx 30 msgs/hora)
    // Pular se banco indisponível — não bloquear clientes por instabilidade do DB
    if (dbAvailable && !(await checkChatbotRateLimit(whatsappId))) {
      logger.warn("Chatbot", `Rate limit atingido para ${phone} (${whatsappId})`);
      const limitMsg = "Você enviou muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente, ou ligue para nosso telefone fixo. 😊";
      await whatsappService.sendText(whatsappId, limitMsg);
      return;
    }

    // Sanitizar mensagem: truncar se muito longa e filtrar prompt injection
    messageText = sanitizeAndValidateMessage(messageText, phone);

    // Determinar o número real do telefone:
    // Se temos realPhone (via remoteJidAlt), usar ele. Caso contrário, usar phone.
    const effectivePhone = realPhone || phone;
    // Normalizar: se o effectivePhone contém @s.whatsapp.net, extrair só os dígitos
    const normalizedPhone = phoneNormalizer.normalize(effectivePhone);

    // ===== VERIFICAÇÃO ANTECIPADA DO MODO HUMANO =====
    // CAMADA 1: Cache em memória (rápido, não depende de lookup de JID no banco)
    // Garante silenciamento mesmo se o JID mudar entre @lid e @s.whatsapp.net
    if (isHumanModeCached(normalizedPhone)) {
      logger.info("Chatbot", `Modo humano ativo (CACHE) — bot silencioso para ${phone}`);
      // Tentar salvar mensagem no histórico em background
      if (dbAvailable) {
        getActiveConversationByWhatsappId(whatsappId, realPhone)
          .then(conv => conv && createMessage({
            conversationId: conv.id,
            role: "user",
            content: messageText,
            messageType: "text",
            metadata: JSON.stringify({ humanMode: true }),
          }))
          .catch((err: unknown) => logger.warn("Chatbot", "Falha ao salvar msg em modo humano (cache)", err));
      }
      return;
    }

    // CAMADA 2: Verificação via banco de dados (mais lenta, mas persistente)
    // DEVE ser feita ANTES do FAQ cache para garantir que o bot fique 100% silencioso
    // quando o modo humano está ativo (mesmo para perguntas frequentes).
    if (dbAvailable) {
      const earlyConv = await getActiveConversationByWhatsappId(whatsappId, realPhone);
      if (earlyConv?.humanMode) {
        const stillHuman = await checkAndExpireHumanMode(earlyConv.id);
        if (stillHuman) {
          // Sincronizar cache com o banco
          if (earlyConv.humanModeUntil) {
            setHumanModeCache(normalizedPhone, new Date(earlyConv.humanModeUntil).getTime());
          }
          logger.info("Chatbot", `Modo humano ativo (verificação antecipada DB) — bot silencioso para ${phone}`);
          // Salvar mensagem do usuário no histórico mesmo em modo humano
          await createMessage({
            conversationId: earlyConv.id,
            role: "user",
            content: messageText,
            messageType: "text",
            metadata: JSON.stringify({ humanMode: true }),
          }).catch((err: unknown) => logger.warn("Chatbot", "Falha ao salvar msg em modo humano", err));
          return;
        }
        logger.info("Chatbot", `Modo humano expirado para ${phone} — bot retomando atendimento`);
      }
    }

    // Verificar cache de FAQ DEPOIS da verificação de modo humano
    // Funciona mesmo quando o banco está indisponível (degradação graciosa)
    const faqResponse = checkFaqCache(messageText);
    if (faqResponse) {
      logger.info("Chatbot", `FAQ cache hit para ${phone}: "${messageText.slice(0, 50)}"`);
      // Enviar resposta imediatamente (não depende do banco)
      await whatsappService.sendText(whatsappId, faqResponse);
      // Persistir histórico no banco em background (não crítico — não falhar se DB indisponível)
      if (dbAvailable) {
        findOrCreateCustomerAndConversation(whatsappId, normalizedPhone, messageId, pushName, realPhone)
          .then(({ conversation }) => Promise.all([
            createMessage({ conversationId: conversation.id, role: "user", content: messageText, messageType: "text", metadata: null }),
            createMessage({ conversationId: conversation.id, role: "assistant", content: faqResponse, messageType: "text", metadata: JSON.stringify({ source: "faq_cache" }) }),
          ]))
          .catch((err: unknown) => logger.warn("Chatbot", "FAQ: falha ao persistir histórico no banco (não crítico)", err));
      }
      return;
    }

    // Modo degradado: banco indisponível e sem hit de FAQ
    // Chamar LLM sem histórico para continuar atendendo mesmo assim
    if (!dbAvailable) {
      logger.warn("Chatbot", `Banco indisponível — modo degradado para ${phone}`);
      try {
        const { diaSemana, dataCompleta, horarioAtual } = getBRTDateTimeFormatted();
        const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);
        const degradedResult = await withRetry(
          () => invokeLLM({ messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: messageText },
          ] }),
          { maxRetries: 2, delayMs: 1500, label: "invokeLLM-degraded" }
        );
        const aiContent = degradedResult.choices[0]?.message?.content;
        type DegradedContentPart = { type: string; text?: string };
        let aiText = typeof aiContent === "string"
          ? aiContent
          : Array.isArray(aiContent)
            ? (aiContent as DegradedContentPart[]).find((c) => c.type === "text")?.text || ""
            : "";
        aiText = sanitizeLLMOutput(aiText) || "Desculpe, estou com dificuldades técnicas. Por favor, ligue para o restaurante. 🙏";
        await whatsappService.sendText(whatsappId, aiText);
      } catch (degradedErr) {
        logger.error("Chatbot", "Erro no modo degradado", degradedErr);
        await whatsappService.sendText(whatsappId, "Estamos com dificuldades técnicas no momento. Por favor, ligue para o restaurante ou tente novamente em alguns minutos. 🙏").catch(() => {});
      }
      return;
    }

    // 1+2. Buscar/criar cliente e conversa ativa (banco disponível)
    const { customer, conversation } = await findOrCreateCustomerAndConversation(
      whatsappId,
      normalizedPhone,
      messageId,
      pushName,
      realPhone
    );

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
    // Usa UPDATE atômico para evitar race condition entre múltiplas instâncias do servidor.
    if (conversation.humanMode) {
      const stillHuman = await checkAndExpireHumanMode(conversation.id);
      if (stillHuman) {
        logger.info("Chatbot", `Modo humano ativo — bot silencioso para ${phone}`);
        return;
      }
      logger.info("Chatbot", `Modo humano expirado para ${phone} — bot retomando atendimento`);
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
    // CAMADA 1: Marcador explícito [CHAMAR_ATENDENTE] gerado pelo LLM (preferível)
    const hasExplicitMarker = response.text.includes("[CHAMAR_ATENDENTE]");

    // CAMADA 2: Detecção NLP como fallback — se o LLM esqueceu o marcador mas
    // claramente está transferindo para atendente humano na resposta
    const nlpHumanPhrases = [
      "vou te conectar com",
      "vou te transferir para",
      "vou chamar um atendente",
      "vou transferir você",
      "transferindo para um atendente",
      "conectar com nossa equipe",
      "aguarde um momento que já te conecto",
      "vou te passar para",
      "encaminhando para atendente",
    ];
    const lowerResponse = response.text.toLowerCase();
    const hasNlpHumanTransfer = nlpHumanPhrases.some(phrase => lowerResponse.includes(phrase));

    // Também verificar se o CLIENTE pediu explicitamente atendente humano
    const lowerUserMsg = messageText.toLowerCase();
    const clientRequestedHuman = [
      "quero falar com humano",
      "quero falar com uma pessoa",
      "quero falar com atendente",
      "falar com alguém",
      "atendente humano",
      "pessoa real",
      "falar com gente",
      "quero um atendente",
      "me passa pra um atendente",
      "me transfere",
      "chamar atendente",
      "quero atendimento humano",
    ].some(phrase => lowerUserMsg.includes(phrase));

    const botRequestedHuman = hasExplicitMarker || hasNlpHumanTransfer || clientRequestedHuman;

    if (botRequestedHuman && !hasExplicitMarker) {
      logger.warn("Chatbot", `Modo humano ativado via fallback NLP (sem marcador explícito) para ${phone}. ` +
        `NLP match: ${hasNlpHumanTransfer}, Cliente pediu: ${clientRequestedHuman}`);
    }

    if (botRequestedHuman) {
      try {
        // ATIVAR MODO HUMANO IMEDIATAMENTE (30 min)
        // O bot fica silencioso a partir de agora, sem esperar o operador responder
        const humanModeUntil = new Date(Date.now() + CHATBOT.HUMAN_MODE_DURATION_MS);
        await updateConversation(conversation.id, {
          humanMode: true,
          humanModeUntil,
        });
        // Cachear em memória para garantir silenciamento imediato
        setHumanModeCache(normalizedPhone, humanModeUntil.getTime());
        logger.info("Chatbot", `✅ Modo humano ATIVADO PREVENTIVAMENTE para ${phone} até ${humanModeUntil.toISOString()}`);

        // Se o modo humano foi ativado via fallback (sem marcador explícito do LLM),
        // garantir que a resposta ao cliente inclua uma mensagem de transição clara
        if (!hasExplicitMarker) {
          // Substituir a resposta do LLM por uma mensagem de transição padrão
          // (o LLM pode ter respondido algo genérico sem mencionar a transferência)
          response.text = "Certo! Aguarde uns minutinhos que já vou chamar um atendente para te ajudar. \u{1F60A}\n\nSe for urgente, pode ligar no nosso telefone fixo: (17) 3325-8628 \u{1F4DE}\n\nLembre-se que este número de WhatsApp não recebe ligações. Para ligar, use sempre o telefone fixo acima.";
          logger.info("Chatbot", `Resposta substituída por mensagem de transição padrão (fallback NLP)`);
        }

        // Enviar alerta ao restaurante (notificação para o operador)
        const settings = await getRestaurantSettings();
        const restaurantPhone = settings?.phone
          ? settings.phone.replace(/\D/g, "")
          : process.env.RESTAURANT_PHONE?.replace(/\D/g, "") || "5517982123269";

        if (!restaurantPhone) {
          logger.warn("Chatbot", "Telefone do restaurante não configurado — alerta de atendente não enviado");
        } else {
          const restaurantPhoneNorm = restaurantPhone.startsWith("55")
            ? restaurantPhone
            : `55${restaurantPhone}`;
          // Na Cloud API, usar apenas o número (sem @s.whatsapp.net)
          // Na Evolution API, usar JID completo
          const provider = whatsappService.getActiveProvider();
          const restaurantJid = provider === "cloud_api"
            ? restaurantPhoneNorm
            : `${restaurantPhoneNorm}@s.whatsapp.net`;

          const alertMsg =
            `\u{1F6A8} *Atenção — Cliente chamando atendente!*\n\n` +
            `\u{1F464} *Cliente:* ${customer.name || phone}\n` +
            `\u{1F4F1} *Telefone:* ${phone}\n` +
            `\u{1F4AC} *Última mensagem:* "${messageText.substring(0, 100)}"\n\n` +
            `\u{1F449} Abra o chat deste contato e responda diretamente.\n` +
            `_O bot está pausado por 30 min. Envie #bot para reativar._`;

          const alertSent = await whatsappService.sendText(restaurantJid, alertMsg).catch((err: unknown) => {
            logger.warn("Chatbot", `Falha ao enviar alerta WhatsApp para restaurante (${restaurantJid})`, err);
            return false;
          });

          // Fallback: se o alerta via WhatsApp falhou (ex: número não na lista de teste),
          // enviar via notificação do sistema (push notification para o owner)
          if (!alertSent) {
            logger.info("Chatbot", "Alerta WhatsApp falhou — enviando via notificação do sistema");
            try {
              const { notifyOwner } = await import("./_core/notification");
              await notifyOwner({
                title: "\u{1F6A8} Cliente chamando atendente!",
                content: `Cliente: ${customer.name || phone}\nTelefone: ${phone}\nÚltima msg: "${messageText.substring(0, 100)}"\n\nO bot está pausado por 30 min.`,
              });
            } catch (notifyErr) {
              logger.error("Chatbot", "Falha ao enviar notificação de fallback", notifyErr);
            }
          } else {
            logger.info("Chatbot", `Alerta de atendimento humano enviado para ${restaurantJid}`);
          }
        }
      } catch (err) {
        logger.error("Chatbot", "Erro ao ativar modo humano preventivo", err);
      }
    }

    // 7c. Remover marcador [CHAMAR_ATENDENTE] da resposta antes de enviar ao cliente
    // O cliente NÃO deve ver o marcador interno do sistema
    if (response.text.includes("[CHAMAR_ATENDENTE]")) {
      response.text = response.text
        .replace(/\[CHAMAR_ATENDENTE\]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    // 8. Enviar resposta ao cliente
    // IMPORTANTE: usar o whatsappId original (pode ser @lid) para enviar mensagens,
    // pois a Evolution API precisa do JID correto para rotear a mensagem

    // Verificar se a resposta contém link de pedido
    const orderLinkMatch = response.text.match(/https:\/\/[^\s]+\/pedido\/[a-f0-9]+/);
    const activeProvider = whatsappService.getActiveProvider();

    if (orderLinkMatch && activeProvider === "evolution") {
      // Evolution API: enviar como imagem com banner visual
      const orderLink = orderLinkMatch[0];
      const textBeforeLink = response.text.split(orderLink)[0].trim();
      const textAfterLink = response.text.split(orderLink)[1]?.trim() || "";
      const caption = `${textBeforeLink}\n\n${orderLink}\n\n${textAfterLink}`.trim();

      const bannerUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663208695668/hEsNGYEonud5ngJEe9CdHq/banner_cardapio_digital_900x900_b8c4719c.png";
      logger.info("Chatbot", `[Evolution] Enviando resposta com banner + link de pedido para ${phone}`);
      const sent = await whatsappService.sendMedia(whatsappId, bannerUrl, caption);
      if (!sent) {
        logger.warn("Chatbot", `[Evolution] Envio de mídia falhou para ${phone} — tentando fallback como texto`);
        const textSent = await whatsappService.sendText(whatsappId, response.text);
        if (!textSent) {
          logger.error("Chatbot", `[Evolution] Fallback de texto também falhou para ${phone}`, null);
        }
      }
    } else {
      // Cloud API ou mensagem sem link: enviar como texto
      // Cloud API: preview_url=true é habilitado automaticamente quando há links
      // Isso é mais confiável que enviar imagem com caption na Cloud API
      if (orderLinkMatch) {
        logger.info("Chatbot", `[${activeProvider}] Enviando resposta de delivery como TEXTO com preview_url para ${phone}`);
      } else {
        logger.info("Chatbot", `[${activeProvider}] Enviando resposta de texto para ${phone}`);
      }
      const sent = await whatsappService.sendText(whatsappId, response.text);
      if (!sent) {
        logger.error("Chatbot", `Falha ao enviar resposta para ${phone} via ${activeProvider}`, null);
      }
    }
  } catch (error) {
    logger.error("Chatbot", "Error processing message", error);
    await whatsappService.sendText(whatsappId, "Desculpe, ocorreu um erro. Por favor, tente novamente.").catch((sendErr: unknown) => {
      logger.warn("Chatbot", "Falha ao enviar mensagem de erro ao cliente", sendErr);
    });
  }
}

interface BotResponse {
  text: string;
  updatedContext?: ChatContext;
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
  // Obter data/hora atual para contexto (fuso Brasília UTC-3) — com cache de 500ms
  const { diaSemana, dataCompleta, horarioAtual } = getBRTDateTimeFormatted();

  // Usar o prompt COMPLETO do restaurante
  const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

  // Buscar e construir bloco de contexto do cliente (pedidos recentes + reservas ativas)
  const customerContextBlock = await buildCustomerContextBlock(customerId);

  // Obter histórico de mensagens (30 mensagens para contexto mais amplo)
  const history = await getConversationMessages(conversationId, 30);
  // getConversationMessages retorna DESC, precisamos reverter para ordem cronológica
  history.reverse();

  // ===== DETECTAR MENSAGENS DO OPERADOR HUMANO NO HISTÓRICO =====
  // Quando o atendente humano respondeu durante o modo humano, essas mensagens
  // ficam salvas com metadata { humanOperator: true }. Precisamos identificar
  // o que o humano combinou com o cliente para que a LLM respeite esses acordos.
  const humanOperatorContext = buildHumanOperatorContext(history);

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt + customerContextBlock + humanOperatorContext },
  ];

  // Adicionar histórico (últimas 30 mensagens para mais contexto e retenção de memória)
  // IMPORTANTE: remover links de pedido do histórico para forçar a IA a sempre usar [GERAR_LINK_PEDIDO]
  // Isso garante que cada pedido gere um link novo, mesmo que o cliente peça várias vezes
  const recentHistory = history.slice(-30);
  for (const msg of recentHistory) {
    let content = msg.content;
    // Substituir links de pedido por [GERAR_LINK_PEDIDO] no histórico do assistente
    if (msg.role === "assistant") {
      content = content.replace(/https?:\/\/[^\s]+\/pedido\/[a-f0-9]+/g, "[GERAR_LINK_PEDIDO]");
    }
    // Marcar mensagens do operador humano para que a LLM saiba quem falou
    let isHumanOperator = false;
    try {
      const meta = msg.metadata ? JSON.parse(msg.metadata as string) : null;
      isHumanOperator = meta?.humanOperator === true;
    } catch {}

    if (isHumanOperator) {
      // Prefixar mensagens do operador para que a LLM saiba que foi o atendente humano
      content = `[ATENDENTE HUMANO respondeu]: ${content}`;
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

  // Chamar IA com retry para erros transientes
  let response: Awaited<ReturnType<typeof invokeLLM>>;
  try {
    response = await withRetry(
      () => invokeLLM({ messages }),
      { maxRetries: 2, delayMs: 1500, label: "invokeLLM-chatbot" }
    );
  } catch (llmError) {
    logger.error("Chatbot", "Falha ao chamar invokeLLM após retries", llmError);
    return {
      text: "Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em instantes ou ligue para o restaurante. 🙏",
    };
  }

  const aiContent = response.choices[0]?.message?.content;
  type LLMContentPart = { type: string; text?: string };
  let aiResponse = typeof aiContent === "string"
    ? aiContent
    : Array.isArray(aiContent)
      ? (aiContent as LLMContentPart[]).find((c) => c.type === "text")?.text || "Desculpe, não entendi. Pode reformular?"
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
 * Retoma a conversa automaticamente após o operador enviar #bot.
 * Busca o histórico da conversa, identifica a última pergunta do cliente
 * que ficou sem resposta do bot, e gera uma resposta proativa.
 *
 * LÓGICA DE PRIORIDADE para encontrar a mensagem a responder:
 * 1. Mensagens do cliente com metadata humanMode=true (enviadas durante modo humano)
 *    → Pega a ÚLTIMA dessas mensagens (a mais recente)
 * 2. Se não houver mensagens de modo humano, pega a ÚLTIMA mensagem do cliente
 *    que NÃO tenha resposta do bot logo em seguida
 * 3. Se todas as mensagens já foram respondidas, envia saudação genérica
 *
 * @param remoteJid - JID do cliente (para enviar a mensagem)
 * @param realPhone - Número real do telefone (quando JID é @lid)
 */
export async function resumeConversationAfterBot(
  remoteJid: string,
  realPhone?: string
): Promise<void> {
  try {
    const phone = phoneNormalizer.normalize(realPhone || remoteJid);
    logger.info("Chatbot", `Retomando conversa automaticamente para ${phone} (${remoteJid})`);

    // Buscar customer e conversa ativa
    const customer = await getCustomerByWhatsappId(remoteJid, realPhone);
    if (!customer) {
      logger.warn("Chatbot", `Customer não encontrado para retomada: ${remoteJid}`);
      return;
    }

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      logger.warn("Chatbot", `Conversa ativa não encontrada para retomada: customer ${customer.id}`);
      return;
    }

    // Buscar últimas 30 mensagens para ter contexto amplo
    const history = await getConversationMessages(conversation.id, 30);
    // history vem em DESC, reverter para cronológico
    history.reverse();

    // ===== PRIORIDADE 1: Mensagens do cliente enviadas durante modo humano =====
    // Estas são as mensagens mais relevantes porque foram enviadas enquanto o bot
    // estava silenciado — o cliente está esperando resposta sobre ESTES assuntos.
    const humanModeMessages = history.filter(m => {
      if (m.role !== "user") return false;
      try {
        const meta = m.metadata ? JSON.parse(m.metadata as string) : null;
        return meta?.humanMode === true;
      } catch {
        return false;
      }
    });

    let lastClientMessage = "";

    if (humanModeMessages.length > 0) {
      // Pegar a ÚLTIMA mensagem do modo humano (a mais recente)
      lastClientMessage = humanModeMessages[humanModeMessages.length - 1]!.content;
      logger.info("Chatbot", `Retomada: usando última mensagem do modo humano: "${lastClientMessage.substring(0, 80)}"`);
    } else {
      // ===== PRIORIDADE 2: Última mensagem do cliente sem resposta do bot =====
      // Percorrer de trás para frente buscando a última mensagem do user
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i]!.role === "user") {
          // Verificar se há resposta do bot DEPOIS desta mensagem
          const hasResponse = history.slice(i + 1).some(m => {
            if (m.role !== "assistant") return false;
            // Ignorar respostas que são apenas saudações de retomada ou confirmações do #bot
            try {
              const meta = m.metadata ? JSON.parse(m.metadata as string) : null;
              if (meta?.resumeAfterBot) return false;
            } catch {}
            return true;
          });

          if (!hasResponse) {
            lastClientMessage = history[i]!.content;
            logger.info("Chatbot", `Retomada: usando última mensagem sem resposta: "${lastClientMessage.substring(0, 80)}"`);
            break;
          }
        }
      }
    }

    if (!lastClientMessage) {
      // Sem mensagem pendente, enviar saudação genérica de retomada
      const resumeMsg = "Oi! O Gauchinho voltou! 🤠 Posso te ajudar em mais alguma coisa?";
      await whatsappService.sendText(remoteJid, resumeMsg);
      await createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: resumeMsg,
        messageType: "text",
        metadata: JSON.stringify({ resumeAfterBot: true }),
      }).catch(() => {});
      logger.info("Chatbot", `Retomada: saudação genérica enviada para ${phone} (sem mensagem pendente)`);
      return;
    }

    // Gerar resposta para a mensagem pendente do cliente
    logger.info("Chatbot", `Gerando resposta de retomada para: "${lastClientMessage.substring(0, 80)}"`);

    const context: ChatContext = conversation.context
      ? JSON.parse(conversation.context as string)
      : {};

    const response = await generateResponse(
      customer.id,
      conversation.id,
      lastClientMessage,
      context,
      phone
    );

    // Remover marcador [CHAMAR_ATENDENTE] se presente (não queremos reativar modo humano na retomada)
    let responseText = response.text
      .replace(/\[CHAMAR_ATENDENTE\]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Enviar resposta ao cliente
    const resumeProvider = whatsappService.getActiveProvider();
    const orderLinkMatch = responseText.match(/https:\/\/[^\s]+\/pedido\/[a-f0-9]+/);
    if (orderLinkMatch && resumeProvider === "evolution") {
      // Evolution API: enviar como imagem com banner
      const orderLink = orderLinkMatch[0];
      const textBeforeLink = responseText.split(orderLink)[0]!.trim();
      const textAfterLink = responseText.split(orderLink)[1]?.trim() || "";
      const caption = `${textBeforeLink}\n\n${orderLink}\n\n${textAfterLink}`.trim();
      const bannerUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663208695668/hEsNGYEonud5ngJEe9CdHq/banner_cardapio_digital_900x900_b8c4719c.png";
      const sent = await whatsappService.sendMedia(remoteJid, bannerUrl, caption);
      if (!sent) {
        await whatsappService.sendText(remoteJid, responseText);
      }
    } else {
      // Cloud API ou sem link: enviar como texto (preview_url habilitado automaticamente)
      await whatsappService.sendText(remoteJid, responseText);
    }

    // Salvar no histórico (NÃO duplicar a mensagem do user se ela já está no histórico)
    // Verificar se a mensagem já existe no histórico para evitar duplicação
    const alreadyInHistory = history.some(m =>
      m.role === "user" && m.content === lastClientMessage
    );
    if (!alreadyInHistory) {
      await createMessage({
        conversationId: conversation.id,
        role: "user",
        content: lastClientMessage,
        messageType: "text",
        metadata: JSON.stringify({ reprocessedAfterBot: true }),
      }).catch(() => {});
    }

    await createMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: responseText,
      messageType: "text",
      metadata: JSON.stringify({ resumeAfterBot: true }),
    }).catch(() => {});

    // Atualizar contexto se necessário
    if (response.updatedContext) {
      await updateConversation(conversation.id, {
        context: JSON.stringify(response.updatedContext),
        intent: response.updatedContext.intent || conversation.intent,
      }).catch(() => {});
    }

    logger.info("Chatbot", `✅ Conversa retomada automaticamente para ${phone}`);
  } catch (err) {
    logger.error("Chatbot", `Erro ao retomar conversa após #bot para ${remoteJid}`, err);
  }
}


/**
 * Constrói um bloco de contexto especial para a LLM quando há mensagens
 * do operador humano no histórico da conversa.
 *
 * Isso garante que o bot:
 * 1. Saiba que houve atendimento humano
 * 2. Respeite TODOS os acordos feitos pelo atendente (descontos, condições, promessas)
 * 3. Nunca contradiga o que o humano combinou com o cliente
 * 4. Incorpore informações especiais (como preços negociados) em reservas/pedidos
 */
function buildHumanOperatorContext(history: Array<{ role: string; content: string; metadata: string | null }>): string {
  // Identificar mensagens do operador humano
  const humanMessages: Array<{ content: string; index: number }> = [];
  const clientDuringHuman: Array<{ content: string; index: number }> = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i]!;
    try {
      const meta = msg.metadata ? JSON.parse(msg.metadata as string) : null;
      if (meta?.humanOperator === true && msg.role === "assistant") {
        humanMessages.push({ content: msg.content, index: i });
      }
      if (meta?.humanMode === true && msg.role === "user") {
        clientDuringHuman.push({ content: msg.content, index: i });
      }
    } catch {}
  }

  // Se não houve atendimento humano, retornar vazio
  if (humanMessages.length === 0) return "";

  // Construir resumo da conversa humana
  let block = "\n\n⚠️⚠️⚠️ CONTEXTO CRÍTICO — ATENDIMENTO HUMANO ANTERIOR ⚠️⚠️⚠️\n\n";
  block += "Um ATENDENTE HUMANO do restaurante conversou com este cliente ANTES de você retomar.\n";
  block += "As mensagens marcadas com [ATENDENTE HUMANO respondeu] no histórico são do atendente real.\n\n";

  block += "REGRAS ABSOLUTAS SOBRE O ATENDIMENTO HUMANO:\n";
  block += "1. RESPEITE TUDO que o atendente humano combinou — descontos, preços especiais, condições, promessas.\n";
  block += "2. NUNCA contradiga o que o atendente disse, mesmo que fuja das regras padrão do restaurante.\n";
  block += "3. Se o atendente deu um desconto (ex: R$ 119,90 em vez de R$ 129,90), USE esse valor em toda a conversa.\n";
  block += "4. Se o atendente fez uma promessa, HONRE essa promessa.\n";
  block += "5. Ao fazer reservas ou pedidos, INCLUA nas observações qualquer condição especial combinada pelo atendente.\n";
  block += "6. Trate as informações do atendente como VERDADE ABSOLUTA para esta conversa.\n";
  block += "7. Se o cliente perguntar sobre algo que o atendente já respondeu, use a resposta do atendente como base.\n\n";

  // Listar o que o atendente conversou (resumo)
  block += "RESUMO DO QUE O ATENDENTE HUMANO CONVERSOU:\n";
  for (const hm of humanMessages) {
    block += `→ Atendente disse: "${hm.content}"\n`;
  }
  for (const cm of clientDuringHuman) {
    block += `→ Cliente perguntou: "${cm.content}"\n`;
  }
  block += "\n";

  // Detectar acordos específicos (descontos, preços)
  const priceRegex = /R\$\s*(\d+[.,]\d{2})/g;
  const humanPrices: string[] = [];
  for (const hm of humanMessages) {
    let match;
    while ((match = priceRegex.exec(hm.content)) !== null) {
      humanPrices.push(match[0]);
    }
  }
  if (humanPrices.length > 0) {
    block += `💰 PREÇOS/VALORES MENCIONADOS PELO ATENDENTE: ${humanPrices.join(", ")}\n`;
    block += "→ USE esses valores (não os valores padrão) ao fazer reservas, cálculos ou informar preços ao cliente.\n";
    block += "→ Se fizer reserva, coloque nas OBSERVAÇÕES: \"Preço especial combinado pelo atendente: " + humanPrices.join(", ") + "\"\n\n";
  }

  return block;
}
