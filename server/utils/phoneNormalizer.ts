/**
 * Utilitário de normalização de número de telefone/JID
 * Centraliza a lógica duplicada em webhookEvolution.ts, messagePolling.ts, chatbot.ts, orderRouter.ts
 */
export const phoneNormalizer = {
  /** Remove JID suffix (@s.whatsapp.net, @lid, @g.us) and all non-digits */
  normalize(input: string): string {
    return input
      .replace(/@s\.whatsapp\.net|@lid|@g\.us/g, "")
      .replace(/\D/g, "");
  },

  /** Convert digits to standard JID format (e.g. "5517999990000@s.whatsapp.net") */
  toJid(digits: string): string {
    return `${this.normalize(digits)}@s.whatsapp.net`;
  },

  /** Ensure Brazilian country code prefix (+55) */
  withCountryCode(digits: string): string {
    const clean = this.normalize(digits);
    return clean.startsWith("55") ? clean : `55${clean}`;
  },
};
