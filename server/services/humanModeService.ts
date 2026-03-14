/**
 * Human Mode Service
 * Manages activation/deactivation of human mode for WhatsApp conversations.
 * Extracted from webhookEvolution.ts to separate business logic from webhook handling.
 *
 * NOTA: As funções recebem `realPhone` opcional para resolver o problema de
 * JIDs @lid que não encontram o customer salvo com @s.whatsapp.net.
 */
import { getCustomerByWhatsappId, getActiveConversation, updateConversation } from "../db";
import { logger } from "../utils/logger";
import { CHATBOT } from "../../shared/constants";

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
 * Activates human mode for a conversation identified by JID.
 * When an operator responds manually, the bot goes silent for HUMAN_MODE_DURATION_MS.
 */
export async function activateHumanModeForJid(remoteJid: string, realPhone?: string): Promise<void> {
  try {
    const customer = await findCustomerByJid(remoteJid, realPhone);
    if (!customer) {
      logger.warn("HumanMode", `Customer NOT FOUND for ${remoteJid} (realPhone: ${realPhone || 'N/A'}) — human mode not activated`);
      return;
    }

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      logger.warn("HumanMode", `Active conversation NOT FOUND for customer ${customer.id} (${remoteJid}) — human mode not activated`);
      return;
    }

    const humanModeUntil = new Date(Date.now() + CHATBOT.HUMAN_MODE_DURATION_MS);
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
    const customer = await findCustomerByJid(remoteJid, realPhone);
    if (!customer) {
      logger.warn("HumanMode", `Customer NOT FOUND for ${remoteJid} (realPhone: ${realPhone || 'N/A'}) — cannot deactivate human mode`);
      return;
    }

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      logger.warn("HumanMode", `Active conversation NOT FOUND for customer ${customer.id} (${remoteJid}) — cannot deactivate human mode`);
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
