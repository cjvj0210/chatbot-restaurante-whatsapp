/**
 * Audit Logging — registra ações administrativas para rastreabilidade
 * Usado em procedures protegidas do painel admin
 */
import { getDb } from "./db";
import { auditLogs } from "../drizzle/schema";

interface AuditEntry {
  userId?: number | null;
  action: string;       // ex: "order.confirm", "reservation.cancel", "menu.update"
  entityType: string;   // ex: "order", "reservation", "menuItem"
  entityId?: number | null;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: typeof entry.details === "object" && entry.details !== null
        ? JSON.stringify(entry.details)
        : (entry.details as string) ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    // Nunca falhar silenciosamente em audit — logar mas não quebrar a operação principal
    console.error("[AuditLog] Erro ao registrar:", err);
  }
}
