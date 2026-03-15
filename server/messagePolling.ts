/**
 * Message Polling Service — Fallback para quando o webhook da Evolution API não dispara
 *
 * Busca mensagens novas na Evolution API a cada 5 segundos via endpoint /chat/findMessages
 * e processa apenas as que ainda não foram vistas (controle por messageId).
 *
 * Funciona em paralelo com o webhook — se o webhook processar primeiro, o polling ignora.
 */

import axios from "axios";
import { processIncomingMessage, resumeConversationAfterBot } from "./chatbot";
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
  for (const [id, ts] of Array.from(processedMessageIds.entries())) {
    if (now - ts > MESSAGE_ID_TTL_MS) processedMessageIds.delete(id);
  }

  // Fallback: remover os mais antigos se ainda exceder o limite
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const sorted = Array.from(processedMessageIds.entries()).sort((a, b) => a[1] - b[1]);
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
    // WP-3: Estender janela de busca proporcionalmente ao backoff.
    // Em operação normal: 120s. Após erros consecutivos (ex: Render cold start),
    // a janela cresce para cobrir mensagens que chegaram durante a indisponibilidade.
    // O tryClaimMessage (INSERT IGNORE) garante que não haverá reprocessamento.
    const now = Math.floor(Date.now() / 1000);
    const backoffWindow = consecutiveErrors > 0
      ? Math.min(120 * Math.pow(2, consecutiveErrors), 1200) // máx 20 min (cobre cold start do Render)
      : 120;
    const since = now - backoffWindow;

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
    // Quando recuperar de erros, manter o contador por ESTA iteração para que
    // o MAX_MESSAGE_AGE_SECONDS expandido ainda se aplique às mensagens desta busca.
    // O contador será zerado DEPOIS do processamento das mensagens.
    const errorsBeforeRecovery = consecutiveErrors;
    if (consecutiveErrors > 0) {
      const expandedAge = Math.min(120 + (consecutiveErrors * 120), 1200);
      logger.info("Polling", `Polling recuperado após ${consecutiveErrors} erro(s) consecutivo(s) — janela expandida para ${expandedAge}s`);
    }

    // Filtrar por timestamp NO CÓDIGO (a API ignora o filtro de timestamp)
    // Só processar mensagens posteriores ao início do polling
    // Janela de idade dinâmica: em operação normal usa 120s, mas após erros
    // consecutivos (ex: Render cold start de até 5 min), expande proporcionalmente
    // para não descartar mensagens que chegaram durante a indisponibilidade.
    // A deduplicação via tryClaimMessage (INSERT IGNORE) garante que não haverá reprocessamento.
    const BASE_MAX_AGE_SECONDS = 120; // 2 minutos em operação normal
    const MAX_MESSAGE_AGE_SECONDS = consecutiveErrors > 0
      ? Math.min(BASE_MAX_AGE_SECONDS + (consecutiveErrors * 120), 1200) // até 20 min após cold start
      : BASE_MAX_AGE_SECONDS;
    const records = allRecords.filter((m: any) => {
      const ts = m.messageTimestamp || 0;
      if (ts < pollingStartTimestamp) return false;
      // Ignorar mensagens muito antigas (proteção contra reprocessamento pós-deploy)
      if (now - ts > MAX_MESSAGE_AGE_SECONDS) {
        logger.debug("Polling", `Mensagem ignorada por idade (${now - ts}s > ${MAX_MESSAGE_AGE_SECONDS}s): ${m.key?.id}`);
        return false;
      }
      return true;
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

      // Mensagens fromMe=true: verificar se é comando #bot do operador
      // O polling não consegue distinguir bot de operador para mensagens normais,
      // mas PODE detectar o comando #bot especificamente (sempre é do operador).
      if (fromMe) {
        // Verificar se é comando #bot (fallback quando webhook não funciona)
        const fmMsg = msg.message || {};
        const fmText = (fmMsg as any).conversation || (fmMsg as any).extendedTextMessage?.text || "";
        const fmCmd = fmText.trim().toLowerCase();
        if (fmCmd === "#bot" || fmCmd === "#ativar" || fmCmd === "#reativar") {
          logger.info("Polling", `🟢 Comando ${fmCmd} detectado via polling (fallback) para ${remoteJid}`);
          try {
            const { deactivateHumanModeForJid } = await import("./services/humanModeService");
            const { deleteMessageForEveryone } = await import("./evolutionApi");
            // Extrair realPhone para o #bot
            const fmJidAlt = msg.key?.remoteJidAlt || undefined;
            const fmRealPhone = fmJidAlt ? phoneNormalizer.normalize(fmJidAlt) : undefined;
            // Tentar apagar a mensagem #bot
            await deleteMessageForEveryone(remoteJid, msgId, true);
            // Desativar modo humano
            await deactivateHumanModeForJid(remoteJid, fmRealPhone);
            logger.info("Polling", `Bot reativado via polling para ${remoteJid}`);
            // Retomar conversa automaticamente após 2 segundos
            setTimeout(async () => {
              try {
                await resumeConversationAfterBot(remoteJid, fmRealPhone);
              } catch (resumeErr) {
                logger.error("Polling", "Erro ao retomar conversa após #bot", resumeErr);
              }
            }, 2000);
          } catch (err) {
            logger.error("Polling", `Erro ao processar #bot via polling`, err);
          }
        }
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

      logger.debug("Polling", `Nova mensagem de ${phone} (${pushName}): "${messageText.substring(0, 80)}" | realPhone: ${realPhone || 'N/A'}`);

      // Processar mensagem pelo chatbot (mesmo fluxo do webhook, com pushName e realPhone)
      try {
        await processIncomingMessage(whatsappId, phone, messageText, msgId, pushName || undefined, realPhone);
        logger.debug("Polling", `Mensagem processada com sucesso: ${msgId}`);
      } catch (err) {
        logger.error("Polling", `Erro ao processar mensagem ${msgId}`, err);
      }
    }
    // Zerar o contador de erros DEPOIS de processar as mensagens com janela expandida
    if (errorsBeforeRecovery > 0) {
      consecutiveErrors = 0;
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
    pollErrors: consecutiveErrors,
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
