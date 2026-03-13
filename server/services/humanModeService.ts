/**
 * Human Mode Service
 * Manages activation/deactivation of human mode for WhatsApp conversations.
 * Extracted from webhookEvolution.ts to separate business logic from webhook handling.
 */
import { getCustomerByWhatsappId, getActiveConversation, updateConversation } from "../db";
import { logger } from "../utils/logger";
import { CHATBOT } from "../../shared/constants";

/**
 * Activates human mode for a conversation identified by JID.
 * When an operator responds manually, the bot goes silent for HUMAN_MODE_DURATION_MS.
 */
export async function activateHumanModeForJid(remoteJid: string): Promise<void> {
  try {
    const customer = await getCustomerByWhatsappId(remoteJid);
    if (!customer) {
      logger.info("HumanMode", `Customer not found for ${remoteJid} — human mode not activated`);
      return;
    }

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      logger.info("HumanMode", `Active conversation not found for ${remoteJid} — human mode not activated`);
      return;
    }

    const humanModeUntil = new Date(Date.now() + CHATBOT.HUMAN_MODE_DURATION_MS);
    await updateConversation(conversation.id, { humanMode: true, humanModeUntil });

    logger.info("HumanMode", `Human mode ACTIVATED for ${remoteJid} until ${humanModeUntil.toISOString()}`);
  } catch (err) {
    logger.error("HumanMode", `Error activating human mode for ${remoteJid}`, err);
  }
}

/**
 * Deactivates human mode for a conversation identified by JID.
 * Called when the operator sends the #bot command.
 */
export async function deactivateHumanModeForJid(remoteJid: string): Promise<void> {
  try {
    const customer = await getCustomerByWhatsappId(remoteJid);
    if (!customer) {
      logger.info("HumanMode", `Customer not found for ${remoteJid}`);
      return;
    }

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      logger.info("HumanMode", `Active conversation not found for ${remoteJid}`);
      return;
    }

    await updateConversation(conversation.id, { humanMode: false, humanModeUntil: null });
    logger.info("HumanMode", `Human mode DEACTIVATED for ${remoteJid} — bot resuming`);
  } catch (err) {
    logger.error("HumanMode", `Error deactivating human mode for ${remoteJid}`, err);
  }
}

/**
 * Checks if human mode is currently active and not expired for a JID.
 */
export async function isHumanModeActiveForJid(remoteJid: string): Promise<boolean> {
  try {
    const customer = await getCustomerByWhatsappId(remoteJid);
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
