import { getDb } from "./db";
import { orderSessions, testSessions, testMessages, conversations, messages, botMessages } from "../drizzle/schema";
import { lt, and, eq, lte, or, desc } from "drizzle-orm";
import { checkInstanceStatus, sendTextMessageEvolution } from "./evolutionApi";
import { notifyOwner } from "./_core/notification";
import { logger } from "./utils/logger";
import { phoneNormalizer } from "./utils/phoneNormalizer";

let lastInstanceStatus: string = "unknown";
let instanceAlertSent = false;

/**
 * Limpeza de sessões expiradas e dados antigos (rodar 1x por hora)
 */
export async function runMaintenance(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();

    // 1. Limpar orderSessions expiradas (> 24h)
    const expiredSessions = await db
      .delete(orderSessions)
      .where(lt(orderSessions.expiresAt, now));
    
    // 2. Limpar testSessions inativas há mais de 7 dias
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await db
      .delete(testSessions)
      .where(lt(testSessions.lastActivityAt, sevenDaysAgo));

    // 3. Limpar mensagens de conversas com mais de 90 dias
    // (manter histórico recente, remover conversas muito antigas)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    await db
      .delete(messages)
      .where(lt(messages.createdAt, ninetyDaysAgo));

    logger.info("Maintenance", `Limpeza concluída em ${now.toISOString()}`);
  } catch (err) {
    logger.error("Maintenance", "Erro na limpeza", err);
  }
}

/**
 * Monitoramento da instância WhatsApp (rodar a cada 5 minutos)
 * Envia alerta ao dono se a instância desconectar
 */
export async function monitorWhatsAppInstance(): Promise<void> {
  try {
    const status = await checkInstanceStatus();

    if (status !== lastInstanceStatus) {
      logger.info("Monitor", `Status WhatsApp mudou: ${lastInstanceStatus} → ${status}`);
      lastInstanceStatus = status;
    }

    if (status !== "open") {
      // Instância desconectada — alertar apenas uma vez até reconectar
      if (!instanceAlertSent) {
        instanceAlertSent = true;
        logger.warn("Monitor", `WhatsApp desconectado! Status: ${status}`);
        await notifyOwner({
          title: "⚠️ WhatsApp Desconectado",
          content: `A instância WhatsApp está com status "${status}". Acesse o painel de configurações e reconecte o QR Code para restaurar o atendimento automático.`,
        }).catch((err: unknown) => { logger.warn("Monitor", "Falha ao notificar dono sobre desconexão WhatsApp", err); });
      }
    } else {
      // Reconectou — resetar flag para permitir próximo alerta
      if (instanceAlertSent) {
        instanceAlertSent = false;
        logger.info("Monitor", "WhatsApp reconectado.");
        await notifyOwner({
          title: "✅ WhatsApp Reconectado",
          content: "A instância WhatsApp voltou ao status 'open'. O atendimento automático foi restaurado.",
        }).catch((err: unknown) => { logger.warn("Monitor", "Falha ao notificar dono sobre reconexão WhatsApp", err); });
      }
    }
  } catch (err) {
    logger.error("Monitor", "Erro ao verificar instância WhatsApp", err);
  }
}

/**
 * Worker de retry: reprocessa mensagens com falha (rodar a cada 5 minutos)
 * Tenta reenviar mensagens com status 'failed' que ainda têm retries disponíveis
 */
export async function retryFailedMessages(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const MAX_RETRIES = 3;

  try {
    // Buscar mensagens pendentes ou com falha que ainda têm tentativas disponíveis
    // Prioriza as mais recentes (DESC) para não ficar preso em mensagens antigas
    const failedMessages = await db
      .select()
      .from(botMessages)
      .where(
        and(
          or(
            eq(botMessages.status, "failed"),
            eq(botMessages.status, "pending")
          ),
          lte(botMessages.retries, MAX_RETRIES)
        )
      )
      .orderBy(desc(botMessages.createdAt))
      .limit(10); // Processar no máximo 10 por vez

    if (failedMessages.length === 0) return;

    logger.info("Maintenance", `RetryWorker: Processando ${failedMessages.length} mensagens com falha...`);

    for (const msg of failedMessages) {
      if (!msg.whatsappNumber) continue;

      // Normalizar telefone para formato 55XXXXXXXXXXX
      const normalizedPhone = phoneNormalizer.withCountryCode(msg.whatsappNumber);
      const sent = await sendTextMessageEvolution(normalizedPhone, msg.message);

      if (sent) {
        await db
          .update(botMessages)
          .set({
            status: "sent",
            sentAt: new Date(),
            errorMessage: null,
            retries: msg.retries + 1,
          })
          .where(eq(botMessages.id, msg.id));
        logger.info("Maintenance", `RetryWorker: Mensagem ${msg.id} reenviada com sucesso.`);
      } else {
        const newRetries = msg.retries + 1;
        await db
          .update(botMessages)
          .set({
            retries: newRetries,
            errorMessage: `Falha no retry ${newRetries} de ${MAX_RETRIES}`,
            // Se esgotou tentativas, manter como failed mas não tentar mais
          })
          .where(eq(botMessages.id, msg.id));

        if (newRetries >= MAX_RETRIES) {
          logger.warn("Maintenance", `RetryWorker: Mensagem ${msg.id} esgotou ${MAX_RETRIES} tentativas. Abandonando.`);
        }
      }
    }
  } catch (err) {
    logger.error("Maintenance", "RetryWorker: Erro no worker de retry", err);
  }
}

/**
 * Expira conversas em modo humano cujo prazo já passou (rodar a cada 5 minutos)
 * O modo humano expira automaticamente após 30 min, mas só era detectado na próxima mensagem do cliente.
 * Esta função garante expiração proativa para manter relatórios precisos.
 */
export async function expireHumanModes(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const result = await db
      .update(conversations)
      .set({ humanMode: false, humanModeUntil: null })
      .where(
        and(
          eq(conversations.humanMode, true),
          lt(conversations.humanModeUntil, new Date())
        )
      );

    const affectedRows = (result as any)?.[0]?.affectedRows ?? 0;
    if (affectedRows > 0) {
      logger.info("Maintenance", `${affectedRows} conversas em modo humano expiradas`);
    }
  } catch (err) {
    logger.error("Maintenance", "Erro ao expirar modos humanos", err);
  }
}
