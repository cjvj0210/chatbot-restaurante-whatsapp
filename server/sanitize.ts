/**
 * Sanitização de inputs e outputs
 * - sanitizeInput: remove HTML/XSS de campos de texto do usuário
 * - sanitizeLLMOutput: limpa output do LLM antes de enviar ao WhatsApp
 */
import xss from "xss";

// Configuração do XSS: remover TODAS as tags HTML
const xssOptions = {
  whiteList: {},          // nenhuma tag permitida
  stripIgnoreTag: true,   // remover tags desconhecidas
  stripIgnoreTagBody: ["script", "style"], // remover conteúdo de script/style
};

/**
 * Sanitiza input de texto do usuário (campos de formulário, mensagens)
 * Remove qualquer HTML/JS malicioso
 */
export function sanitizeInput(text: string): string {
  if (!text || typeof text !== "string") return "";
  return xss(text.trim(), xssOptions);
}

/**
 * Sanitiza output do LLM antes de enviar ao WhatsApp
 * Remove:
 * - Tags HTML/XML residuais
 * - URLs de dados (data:) que poderiam conter payloads
 * - Tentativas de injeção de comandos do sistema
 * - Markdown excessivo que o WhatsApp não renderiza
 */
export function sanitizeLLMOutput(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Remover tags HTML/XML residuais
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // 2. Remover data URIs (potencial vetor de ataque)
  cleaned = cleaned.replace(/data:[a-zA-Z]+\/[a-zA-Z]+;base64,[^\s]+/g, "[conteúdo removido]");

  // 3. Remover tentativas de injeção de comandos do sistema
  cleaned = cleaned.replace(/\[system\].*?\[\/system\]/gi, "");
  cleaned = cleaned.replace(/\[assistant\].*?\[\/assistant\]/gi, "");

  // 4. Remover URLs suspeitas (javascript:, vbscript:)
  cleaned = cleaned.replace(/(?:javascript|vbscript|data):/gi, "");

  // 5. Limitar tamanho da resposta (WhatsApp tem limite de ~4096 chars)
  const MAX_WHATSAPP_LENGTH = 4000;
  if (cleaned.length > MAX_WHATSAPP_LENGTH) {
    cleaned = cleaned.slice(0, MAX_WHATSAPP_LENGTH) + "\n\n(mensagem truncada)";
  }

  // 6. Limpar espaços excessivos
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Sanitiza um objeto inteiro (para inputs de formulário)
 * Aplica sanitizeInput em todos os campos string
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === "string") {
      (sanitized as any)[key] = sanitizeInput(sanitized[key] as string);
    }
  }
  return sanitized;
}
