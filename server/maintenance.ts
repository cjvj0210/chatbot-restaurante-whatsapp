import { getDb } from "./db";
import { orderSessions, testSessions, testMessages, conversations, messages } from "../drizzle/schema";
import { lt, and, eq } from "drizzle-orm";
import { checkInstanceStatus } from "./evolutionApi";
import { notifyOwner } from "./_core/notification";

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

    console.log(`[Maintenance] Limpeza concluída em ${now.toISOString()}`);
  } catch (err) {
    console.error("[Maintenance] Erro na limpeza:", err);
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
      console.log(`[Monitor] Status WhatsApp mudou: ${lastInstanceStatus} → ${status}`);
      lastInstanceStatus = status;
    }

    if (status !== "open") {
      // Instância desconectada — alertar apenas uma vez até reconectar
      if (!instanceAlertSent) {
        instanceAlertSent = true;
        console.warn(`[Monitor] WhatsApp desconectado! Status: ${status}`);
        await notifyOwner({
          title: "⚠️ WhatsApp Desconectado",
          content: `A instância WhatsApp está com status "${status}". Acesse o painel de configurações e reconecte o QR Code para restaurar o atendimento automático.`,
        }).catch(() => {});
      }
    } else {
      // Reconectou — resetar flag para permitir próximo alerta
      if (instanceAlertSent) {
        instanceAlertSent = false;
        console.log("[Monitor] WhatsApp reconectado.");
        await notifyOwner({
          title: "✅ WhatsApp Reconectado",
          content: "A instância WhatsApp voltou ao status 'open'. O atendimento automático foi restaurado.",
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[Monitor] Erro ao verificar instância WhatsApp:", err);
  }
}
