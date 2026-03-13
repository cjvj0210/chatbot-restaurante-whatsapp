/**
 * Message Polling Service — Fallback para quando o webhook da Evolution API não dispara
 *
 * Busca mensagens novas na Evolution API a cada 5 segundos via endpoint /chat/findMessages
 * e processa apenas as que ainda não foram vistas (controle por messageId).
 *
 * Funciona em paralelo com o webhook — se o webhook processar primeiro, o polling ignora.
 */

import axios from "axios";
import { processIncomingMessage } from "./chatbot";
import { getDb } from "./db";
import { conversations, customers } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { transcribeFromPolling } from "./services/audioService";
import { logger } from "./utils/logger";

// Em produção usa 10s (webhook é confiável); em dev usa 3s (webhook pode não funcionar localmente)
// Pode ser sobrescrito via POLL_INTERVAL_MS env var
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS
  ? parseInt(process.env.POLL_INTERVAL_MS, 10)
  : process.env.NODE_ENV === "production"
    ? 10_000
    : 3_000;
const INITIAL_DELAY_MS = 15000; // 15 segundos após iniciar (dar tempo pro servidor subir)
const MAX_PROCESSED_IDS = 500; // Máximo de IDs armazenados em memória

// Set de IDs de mensagens já processadas (evita reprocessamento)
const processedMessageIds = new Set<string>();

// Timestamp da última busca bem-sucedida (em segundos Unix)
let lastPollTimestamp = 0;
let isPolling = false;
let pollErrors = 0;
// Timestamp de quando o polling iniciou (para ignorar mensagens anteriores)
let pollingStartTimestamp = 0;

function getEvolutionConfig() {
  return {
    baseUrl: process.env.EVOLUTION_API_URL || "",
    apiKey: process.env.EVOLUTION_API_KEY || "",
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || "teste",
  };
}

/**
 * Extrai o número de telefone do JID do WhatsApp
 */
function extractPhoneFromJid(jid: string): string {
  return phoneNormalizer.normalize(jid);
}

/**
 * Verifica se o JID é de uma conversa individual
 */
function isIndividualChat(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
}

/**
 * Busca e processa mensagens novas da Evolution API
 */
async function pollMessages(): Promise<void> {
  if (isPolling) return; // Evitar execuções simultâneas
  isPolling = true;

  const { baseUrl, apiKey, instanceName } = getEvolutionConfig();

  if (!baseUrl || !apiKey) {
    isPolling = false;
    return;
  }

  try {
    // Sempre buscar mensagens dos últimos 60 segundos
    // Confiamos no set de IDs processados para evitar duplicatas
    const now = Math.floor(Date.now() / 1000);
    const since = now - 60; // Janela fixa de 60 segundos

    const response = await axios.post(
      `${baseUrl}/chat/findMessages/${instanceName}`,
      {
        where: {
          messageTimestamp: { gte: since },
        },
        limit: 50,
      },
      {
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    const allRecords = response.data?.messages?.records || [];
    lastPollTimestamp = now;
    pollErrors = 0;

    // Filtrar por timestamp NO CÓDIGO (a API ignora o filtro de timestamp)
    // Só processar mensagens posteriores ao início do polling
    const records = allRecords.filter((m: any) => {
      const ts = m.messageTimestamp || 0;
      return ts >= pollingStartTimestamp;
    });

    if (records.length === 0) {
      isPolling = false;
      return;
    }

    // Processar cada mensagem nova
    for (const msg of records) {
      const msgId = msg.key?.id;
      if (!msgId) continue;

      // Pular se já processada
      if (processedMessageIds.has(msgId)) continue;

      // Marcar como processada ANTES de processar (evitar duplicatas)
      processedMessageIds.add(msgId);

      // Limpar IDs antigos se o set ficar muito grande
      if (processedMessageIds.size > MAX_PROCESSED_IDS) {
        const idsArray = Array.from(processedMessageIds);
        const toRemove = idsArray.slice(0, idsArray.length - MAX_PROCESSED_IDS + 100);
        toRemove.forEach((id) => processedMessageIds.delete(id));
      }

      const remoteJid = msg.key?.remoteJid || "";
      const fromMe = msg.key?.fromMe;

      // Ignorar todas as mensagens fromMe (enviadas pelo bot ou operador)
      // NOTA: Não ativar modo humano aqui porque o polling não consegue
      // distinguir mensagens do BOT de mensagens do OPERADOR — ambas são fromMe=true.
      // O modo humano só é ativado via webhook (que recebe em tempo real).
      if (fromMe) {
        continue;
      }

      // Ignorar grupos e status
      if (remoteJid.includes("@g.us") || remoteJid === "status@broadcast" || remoteJid.includes("status")) {
        continue;
      }

      // Verificar se é conversa individual
      if (!isIndividualChat(remoteJid)) {
        continue;
      }

      // Extrair texto da mensagem
      const message = msg.message || {};
      const messageType = msg.messageType || "";
      const pushName = msg.pushName || "";
      let messageText = "";

      if (message.conversation) {
        messageText = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        messageText = message.extendedTextMessage.text;
      } else if (message.buttonsResponseMessage?.selectedDisplayText) {
        messageText = message.buttonsResponseMessage.selectedDisplayText;
      } else if (message.listResponseMessage?.title) {
        messageText = message.listResponseMessage.title;
      } else if (message.imageMessage?.caption) {
        messageText = message.imageMessage.caption || "[Imagem enviada]";
      } else if (message.audioMessage || messageType === "audioMessage" || messageType === "pttMessage") {
        // Transcrever áudio
        logger.info("Polling", `Áudio recebido, transcrevendo... ID: ${msgId}`);
        const transcription = await transcribeFromPolling(msgId, baseUrl, apiKey, instanceName);
        if (transcription) {
          messageText = transcription;
        } else {
          messageText = "[Áudio recebido - não foi possível transcrever]";
        }
      } else if (message.stickerMessage || message.reactionMessage) {
        continue; // Ignorar stickers e reações
      } else {
        continue; // Tipo não suportado
      }

      if (typeof messageText !== "string" || !messageText.trim()) continue;
      messageText = messageText.slice(0, 2000);

      const phone = extractPhoneFromJid(remoteJid);
      const whatsappId = remoteJid;
      // Extrair número real do telefone quando JID é @lid (via key.remoteJidAlt)
      const remoteJidAlt = msg.key?.remoteJidAlt || undefined;
      const realPhone = remoteJidAlt ? phoneNormalizer.normalize(remoteJidAlt) : undefined;

      logger.info("Polling", `Nova mensagem de ${phone} (${pushName}): "${messageText.substring(0, 80)}" | realPhone: ${realPhone || 'N/A'}`);

      // Processar mensagem pelo chatbot (mesmo fluxo do webhook, com pushName e realPhone)
      try {
        await processIncomingMessage(whatsappId, phone, messageText, msgId, pushName || undefined, realPhone);
        logger.info("Polling", `Mensagem processada com sucesso: ${msgId}`);
      } catch (err) {
        logger.error("Polling", `Erro ao processar mensagem ${msgId}`, err);
      }
    }
  } catch (error: any) {
    pollErrors++;
    if (pollErrors <= 3 || pollErrors % 10 === 0) {
      logger.error("Polling", `Erro ao buscar mensagens (tentativa #${pollErrors})`, error?.message);
    }
  } finally {
    isPolling = false;
  }
}

/**
 * Ativa modo humano quando o operador responde manualmente
 */
async function handleOperatorMessage(clientJid: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const clientPhone = extractPhoneFromJid(clientJid);
    const phoneDigits = clientPhone.slice(-11);
    const phoneLast8 = clientPhone.slice(-8);

    const [customer] = await db
      .select()
      .from(customers)
      .where(or(like(customers.phone, `%${phoneDigits}%`), like(customers.phone, `%${phoneLast8}%`)))
      .limit(1);

    if (customer) {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.customerId, customer.id))
        .orderBy(conversations.createdAt)
        .limit(1);

      if (conv) {
        const humanModeUntil = new Date(Date.now() + 30 * 60 * 1000);
        await db
          .update(conversations)
          .set({ humanMode: true, humanModeUntil })
          .where(eq(conversations.id, conv.id));
        logger.info("Polling", `Modo humano ativado para ${clientPhone} até ${humanModeUntil.toISOString()}`);
      }
    }
  } catch (err) {
    logger.error("Polling", "Erro ao ativar modo humano", err);
  }
}

/**
 * Permite que o webhook registre IDs já processados para evitar duplicatas com o polling
 */
export function markMessageAsProcessed(messageId: string): void {
  processedMessageIds.add(messageId);
}

/**
 * Retorna estatísticas do polling para diagnóstico
 */
export function getPollingStats() {
  return {
    processedCount: processedMessageIds.size,
    lastPollTimestamp,
    lastPollTime: lastPollTimestamp ? new Date(lastPollTimestamp * 1000).toISOString() : "never",
    pollErrors,
    isPolling,
  };
}

/**
 * Inicia o serviço de polling
 */
export function startMessagePolling(): void {
  const { baseUrl } = getEvolutionConfig();

  if (!baseUrl) {
    logger.info("Polling", "EVOLUTION_API_URL não configurado, polling desativado");
    return;
  }

  // Registrar o timestamp de início para ignorar mensagens anteriores
  pollingStartTimestamp = Math.floor(Date.now() / 1000);
  logger.info("Polling", `Iniciado — busca a cada ${POLL_INTERVAL_MS / 1000}s | ignora msgs antes de ${new Date().toISOString()}`);

  // Primeira busca após delay inicial
  setTimeout(() => {
    pollMessages();
  }, INITIAL_DELAY_MS);

  // Polling periódico
  setInterval(() => {
    pollMessages();
  }, POLL_INTERVAL_MS);
}
