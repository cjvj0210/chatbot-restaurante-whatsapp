/**
 * Human Mode Service
 * Manages activation/deactivation of human mode for WhatsApp conversations.
 * Extracted from webhookEvolution.ts to separate business logic from webhook handling.
 *
 * NOTA: As funções recebem `realPhone` opcional para resolver o problema de
 * JIDs @lid que não encontram o customer salvo com @s.whatsapp.net.
 *
 * Integra com o cache em memória do chatbot.ts para garantir silenciamento
 * imediato mesmo quando o lookup do banco falha por JID inconsistente.
 */
import { getCustomerByWhatsappId, getActiveConversation, updateConversation } from "../db";
import { logger } from "../utils/logger";
import { phoneNormalizer } from "../utils/phoneNormalizer";
import { CHATBOT } from "../../shared/constants";
import { setHumanModeCache, clearHumanModeCache } from "../chatbot";

/**
 * Busca um customer pelo remoteJid, com fallback para realPhone.
 * Resolve o problema de JIDs @lid que não encontram customers salvos com @s.whatsapp.net.
 */
async function findCustomerByJid(remoteJid: string, realPhone?: string) {
  // Tentar primeiro pelo remoteJid direto
  let customer = await getCustomerByWhatsappId(remoteJid, realPhone);
  if (customer) return customer;

  // Se o JID é @lid e temos realPhone, tentar pelo número real
  if (remoteJid.endsWith("@lid") && realPhone) {
    const digits = realPhone.replace(/\D/g, "");
    customer = await getCustomerByWhatsappId(`${digits}@s.whatsapp.net`);
    if (customer) {
      logger.info("HumanMode", `Customer encontrado via realPhone fallback: ${digits}@s.whatsapp.net`);
      return customer;
    }
  }

  // Se o JID é @s.whatsapp.net, tentar sem sufixo
  if (remoteJid.endsWith("@s.whatsapp.net")) {
    const phone = remoteJid.replace("@s.whatsapp.net", "");
    customer = await getCustomerByWhatsappId(phone);
    if (customer) return customer;
  }

  return null;
}

/**
 * Extrai o phone normalizado de um remoteJid + realPhone para uso no cache.
 */
function getPhoneForCache(remoteJid: string, realPhone?: string): string {
  if (realPhone) return phoneNormalizer.normalize(realPhone);
  return phoneNormalizer.normalize(remoteJid);
}

/**
 * Activates human mode for a conversation identified by JID.
 * When an operator responds manually, the bot goes silent for HUMAN_MODE_DURATION_MS.
 */
export async function activateHumanModeForJid(remoteJid: string, realPhone?: string): Promise<void> {
  try {
    // SEMPRE cachear em memória, mesmo se o lookup do banco falhar
    const phoneForCache = getPhoneForCache(remoteJid, realPhone);
    const humanModeUntil = new Date(Date.now() + CHATBOT.HUMAN_MODE_DURATION_MS);
    setHumanModeCache(phoneForCache, humanModeUntil.getTime());

    const customer = await findCustomerByJid(remoteJid, realPhone);
    if (!customer) {
      logger.warn("HumanMode", `Customer NOT FOUND for ${remoteJid} (realPhone: ${realPhone || 'N/A'}) — human mode activated ONLY in cache`);
      return;
    }

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      logger.warn("HumanMode", `Active conversation NOT FOUND for customer ${customer.id} (${remoteJid}) — human mode activated ONLY in cache`);
      return;
    }

    await updateConversation(conversation.id, { humanMode: true, humanModeUntil });

    logger.info("HumanMode", `Human mode ACTIVATED for ${remoteJid} (customer ${customer.id}) until ${humanModeUntil.toISOString()}`);
  } catch (err) {
    logger.error("HumanMode", `Error activating human mode for ${remoteJid}`, err);
  }
}

/**
 * Deactivates human mode for a conversation identified by JID.
 * Called when the operator sends the #bot command.
 */
export async function deactivateHumanModeForJid(remoteJid: string, realPhone?: string): Promise<void> {
  try {
    // SEMPRE limpar cache em memória, mesmo se o lookup do banco falhar
    const phoneForCache = getPhoneForCache(remoteJid, realPhone);
    clearHumanModeCache(phoneForCache);

    const customer = await findCustomerByJid(remoteJid, realPhone);
    if (!customer) {
      logger.warn("HumanMode", `Customer NOT FOUND for ${remoteJid} (realPhone: ${realPhone || 'N/A'}) — human mode deactivated ONLY in cache`);
      return;
    }

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      logger.warn("HumanMode", `Active conversation NOT FOUND for customer ${customer.id} (${remoteJid}) — human mode deactivated ONLY in cache`);
      return;
    }

    await updateConversation(conversation.id, { humanMode: false, humanModeUntil: null });
    logger.info("HumanMode", `Human mode DEACTIVATED for ${remoteJid} (customer ${customer.id}) — bot resuming`);
  } catch (err) {
    logger.error("HumanMode", `Error deactivating human mode for ${remoteJid}`, err);
  }
}

/**
 * Checks if human mode is currently active and not expired for a JID.
 */
export async function isHumanModeActiveForJid(remoteJid: string, realPhone?: string): Promise<boolean> {
  try {
    const customer = await findCustomerByJid(remoteJid, realPhone);
    if (!customer) return false;

    const conversation = await getActiveConversation(customer.id);
    if (!conversation || !conversation.humanMode) return false;

    if (conversation.humanModeUntil) {
      return new Date(conversation.humanModeUntil) > new Date();
    }

    return false;
  } catch (err) {
    logger.error("HumanMode", `Error checking human mode for ${remoteJid}`, err);
    return false;
  }
}
