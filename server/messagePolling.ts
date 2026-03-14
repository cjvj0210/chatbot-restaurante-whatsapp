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
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { transcribeFromPolling } from "./services/audioService";
import { logger } from "./utils/logger";
import { CHATBOT } from "../shared/constants";

// Em produção usa 10s (webhook é confiável); em dev usa 3s (webhook pode não funcionar localmente)
// Pode ser sobrescrito via POLL_INTERVAL_MS env var
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS
  ? parseInt(process.env.POLL_INTERVAL_MS, 10)
  : process.env.NODE_ENV === "production"
    ? 10_000
    : 3_000;
const INITIAL_DELAY_MS = 15000; // 15 segundos após iniciar (dar tempo pro servidor subir)
const MAX_PROCESSED_IDS = 500; // Máximo de IDs armazenados em memória
const MESSAGE_ID_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

// Map de IDs de mensagens já processadas: id → timestamp de inserção
const processedMessageIds = new Map<string, number>();

function markMessageAsProcessedLocal(messageId: string): void {
  const now = Date.now();
  processedMessageIds.set(messageId, now);

  // Limpeza por TTL
  for (const [id, ts] of processedMessageIds.entries()) {
    if (now - ts > MESSAGE_ID_TTL_MS) processedMessageIds.delete(id);
  }

  // Fallback: remover os mais antigos se ainda exceder o limite
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const sorted = [...processedMessageIds.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < sorted.length - MAX_PROCESSED_IDS; i++) {
      processedMessageIds.delete(sorted[i]![0]);
    }
  }
}

// Timestamp da última busca bem-sucedida (em segundos Unix)
let lastPollTimestamp = 0;
let isPolling = false;
// Timestamp de quando o polling iniciou (para ignorar mensagens anteriores)
let pollingStartTimestamp = 0;
// Contador de erros consecutivos (resetado no sucesso, usado para backoff e logging)
let consecutiveErrors = 0;
const MAX_BACKOFF_MS = 60_000;

function getEvolutionConfig() {
  return {
    baseUrl: process.env.EVOLUTION_API_URL || "",
    apiKey: process.env.EVOLUTION_API_KEY || "",
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || "teste",
  };
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
    if (consecutiveErrors > 0) {
      logger.info("Polling", `Polling recuperado após ${consecutiveErrors} erro(s) consecutivo(s)`);
      consecutiveErrors = 0;
    }

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
      markMessageAsProcessedLocal(msgId);

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

      const phone = phoneNormalizer.normalize(remoteJid);
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
    consecutiveErrors++;
    const backoffMs = Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors - 1), MAX_BACKOFF_MS);
    if (consecutiveErrors <= 3 || consecutiveErrors % 10 === 0) {
      logger.warn("Polling", `Erro consecutivo #${consecutiveErrors}, próximo poll em ${backoffMs}ms`, error?.message);
    }
  } finally {
    isPolling = false;
  }
}

/**
 * Permite que o webhook registre IDs já processados para evitar duplicatas com o polling
 */
export function markMessageAsProcessed(messageId: string): void {
  markMessageAsProcessedLocal(messageId);
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
 * Loop recursivo de polling com backoff exponencial em caso de erros.
 * Cada iteração agenda a próxima após a conclusão, usando o intervalo
 * base em caso de sucesso ou backoff exponencial em caso de falha.
 */
function pollingLoop(): void {
  pollMessages().finally(() => {
    const nextInterval = consecutiveErrors > 0
      ? Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors - 1), MAX_BACKOFF_MS)
      : POLL_INTERVAL_MS;
    setTimeout(pollingLoop, nextInterval);
  });
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

  // Registrar o timestamp de início, recuando RESTART_SAFETY_WINDOW_SECONDS para cobrir
  // mensagens que chegaram durante o restart do servidor. O tryClaimMessage (INSERT IGNORE)
  // garante que mensagens já processadas antes do restart não sejam reprocessadas.
  pollingStartTimestamp = Math.floor(Date.now() / 1000) - CHATBOT.RESTART_SAFETY_WINDOW_SECONDS;
  logger.info("Polling", `Iniciado — busca a cada ${POLL_INTERVAL_MS / 1000}s | janela de segurança: ${CHATBOT.RESTART_SAFETY_WINDOW_SECONDS}s | ignora msgs antes de ${new Date(pollingStartTimestamp * 1000).toISOString()}`);

  // Primeira busca após delay inicial, depois loop recursivo com backoff
  setTimeout(pollingLoop, INITIAL_DELAY_MS);
}
