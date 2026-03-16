import axios from "axios";
import { logger } from "./utils/logger";

/**
 * Token Refresh Service - Renovação automática do token de longa duração da Meta Cloud API
 *
 * Tokens de longa duração da Meta expiram a cada 60 dias.
 * Este módulo monitora a validade do token e o renova automaticamente
 * antes de expirar (~50 dias), garantindo operação contínua do chatbot.
 *
 * Fluxo de renovação:
 * 1. Token de longa duração atual → Graph API /oauth/access_token
 * 2. Meta retorna novo token de longa duração (60 dias)
 * 3. Atualiza process.env.META_CLOUD_API_TOKEN em runtime
 * 4. Notifica o owner via sistema de notificações
 *
 * IMPORTANTE: Como não há System User (app está em conta pessoal),
 * tokens de longa duração NÃO são permanentes. Precisam ser renovados.
 * Se o token expirar sem renovação, será necessário gerar um novo
 * token temporário manualmente no Facebook Developer Console.
 */

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/** Intervalo de verificação: a cada 24 horas */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Renovar quando faltar menos de 10 dias para expirar */
const RENEWAL_THRESHOLD_DAYS = 10;

/** Timestamp de quando o token atual foi definido (aproximação) */
let tokenSetTimestamp: number = Date.now();

/** Duração do token em segundos (padrão: 60 dias) */
let tokenExpiresInSeconds: number = 60 * 24 * 60 * 60;

/** Timer do scheduler */
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Verifica a validade do token atual usando o endpoint /debug_token
 */
export async function checkTokenValidity(): Promise<{
  valid: boolean;
  expiresAt?: Date;
  daysRemaining?: number;
  error?: string;
}> {
  try {
    const token = process.env.META_CLOUD_API_TOKEN;
    const appSecret = process.env.META_APP_SECRET;

    if (!token) {
      return { valid: false, error: "META_CLOUD_API_TOKEN não configurado" };
    }

    // Usar debug_token para verificar validade
    // Precisa de app_id|app_secret como access_token para debug
    const appId = extractAppIdFromToken(token);

    if (appId && appSecret) {
      const debugResponse = await axios.get(
        `${GRAPH_API_BASE}/debug_token`,
        {
          params: {
            input_token: token,
            access_token: `${appId}|${appSecret}`,
          },
          timeout: 15000,
        }
      );

      const data = debugResponse.data?.data;
      if (data) {
        const isValid = data.is_valid;
        const expiresAt = data.expires_at ? new Date(data.expires_at * 1000) : undefined;
        const daysRemaining = expiresAt
          ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined;

        logger.info("TokenRefresh", `Token válido: ${isValid}, expira em: ${daysRemaining ?? "?"} dias`);

        return { valid: isValid, expiresAt, daysRemaining };
      }
    }

    // Fallback: tentar uma chamada simples para verificar se o token funciona
    const testResponse = await axios.get(
      `${GRAPH_API_BASE}/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      }
    );

    return { valid: !!testResponse.data?.id };
  } catch (error: any) {
    const errorMsg = error?.response?.data?.error?.message || error?.message || "Erro desconhecido";
    logger.error("TokenRefresh", `Erro ao verificar token: ${errorMsg}`, error);
    return { valid: false, error: errorMsg };
  }
}

/**
 * Renova o token de longa duração usando a Graph API
 * Troca o token atual por um novo token de 60 dias
 */
export async function refreshLongLivedToken(): Promise<{
  success: boolean;
  newExpiresIn?: number;
  error?: string;
}> {
  try {
    const currentToken = process.env.META_CLOUD_API_TOKEN;
    const appSecret = process.env.META_APP_SECRET;

    if (!currentToken) {
      return { success: false, error: "META_CLOUD_API_TOKEN não configurado" };
    }
    if (!appSecret) {
      return { success: false, error: "META_APP_SECRET não configurado - necessário para renovação" };
    }

    const appId = extractAppIdFromToken(currentToken);
    if (!appId) {
      return { success: false, error: "Não foi possível extrair App ID do token" };
    }

    logger.info("TokenRefresh", "Iniciando renovação do token de longa duração...");

    const response = await axios.get(
      `${GRAPH_API_BASE}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: currentToken,
        },
        timeout: 30000,
      }
    );

    const newToken = response.data?.access_token;
    const expiresIn = response.data?.expires_in;

    if (!newToken) {
      return { success: false, error: "Resposta da API não contém access_token" };
    }

    // Atualizar o token em runtime
    process.env.META_CLOUD_API_TOKEN = newToken;
    tokenSetTimestamp = Date.now();
    tokenExpiresInSeconds = expiresIn || 60 * 24 * 60 * 60;

    const daysValid = Math.floor(tokenExpiresInSeconds / 86400);
    logger.info("TokenRefresh", `Token renovado com sucesso! Válido por ${daysValid} dias`);

    // Notificar o owner
    try {
      const { notifyOwner } = await import("./_core/notification");
      await notifyOwner({
        title: "Token WhatsApp Cloud API Renovado",
        content: `O token de acesso da Meta Cloud API foi renovado automaticamente.\n\nNovo token válido por ${daysValid} dias (até ${new Date(Date.now() + tokenExpiresInSeconds * 1000).toLocaleDateString("pt-BR")}).\n\nIMPORTANTE: O token foi atualizado apenas em runtime. Para persistir, atualize a variável META_CLOUD_API_TOKEN no painel de configurações.`,
      });
    } catch (notifyError) {
      logger.warn("TokenRefresh", "Falha ao notificar owner sobre renovação", notifyError);
    }

    return { success: true, newExpiresIn: expiresIn };
  } catch (error: any) {
    const errorMsg = error?.response?.data?.error?.message || error?.message || "Erro desconhecido";
    logger.error("TokenRefresh", `Erro ao renovar token: ${errorMsg}`, error);

    // Se o token expirou, notificar urgentemente
    if (errorMsg.includes("expired") || errorMsg.includes("invalid")) {
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: "URGENTE: Token WhatsApp Cloud API Expirado",
          content: `O token de acesso da Meta Cloud API expirou e não pôde ser renovado automaticamente.\n\nErro: ${errorMsg}\n\nAção necessária:\n1. Acesse developers.facebook.com\n2. Gere um novo token temporário\n3. Atualize META_CLOUD_API_TOKEN nas configurações\n\nO chatbot WhatsApp está INOPERANTE até que o token seja atualizado.`,
        });
      } catch (notifyError) {
        logger.error("TokenRefresh", "Falha ao notificar owner sobre expiração", notifyError);
      }
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Extrai o App ID do token (os tokens da Meta começam com o App ID)
 * Formato: EAA{AppID}...
 */
function extractAppIdFromToken(token: string): string | null {
  // Tokens da Meta começam com "EAA" seguido do App ID
  // Ex: EAAUwmEBN9IcBQ... → App ID é a parte entre EAA e BQ/BO/etc
  // Melhor abordagem: usar o endpoint /me para obter o app_id
  // Mas como fallback, podemos tentar extrair

  // O App ID do Clóvis é 1076195502238772 (Phone Number ID)
  // Mas o App ID real é diferente - vamos usar o endpoint /app
  try {
    // Tentar extrair do formato EAA{appId}...
    // Na prática, o App ID é fixo e pode ser configurado via env
    const appId = process.env.META_APP_ID;
    if (appId) return appId;

    // Fallback: o App ID geralmente está nos primeiros caracteres após "EAA"
    // Mas isso não é confiável. Vamos usar o debug_token endpoint que não precisa do app_id
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica e renova o token se necessário
 */
async function checkAndRefreshIfNeeded(): Promise<void> {
  const provider = (process.env.WHATSAPP_PROVIDER || "").toLowerCase();
  if (provider !== "cloud_api") {
    logger.debug("TokenRefresh", "Provider não é cloud_api, pulando verificação");
    return;
  }

  try {
    const validity = await checkTokenValidity();

    if (!validity.valid) {
      logger.warn("TokenRefresh", `Token inválido: ${validity.error}`);
      // Tentar renovar imediatamente
      const result = await refreshLongLivedToken();
      if (!result.success) {
        logger.error("TokenRefresh", `Falha na renovação: ${result.error}`, null);
      }
      return;
    }

    if (validity.daysRemaining !== undefined && validity.daysRemaining <= RENEWAL_THRESHOLD_DAYS) {
      logger.info("TokenRefresh", `Token expira em ${validity.daysRemaining} dias — renovando...`);
      const result = await refreshLongLivedToken();
      if (!result.success) {
        logger.error("TokenRefresh", `Falha na renovação: ${result.error}`, null);
      }
    } else {
      logger.info("TokenRefresh", `Token OK — ${validity.daysRemaining ?? "?"} dias restantes`);
    }
  } catch (error) {
    logger.error("TokenRefresh", "Erro no ciclo de verificação", error);
  }
}

/**
 * Inicia o scheduler de renovação automática
 */
export function startTokenRefreshScheduler(): void {
  const provider = (process.env.WHATSAPP_PROVIDER || "").toLowerCase();
  if (provider !== "cloud_api") {
    logger.info("TokenRefresh", "Provider não é cloud_api — scheduler de renovação não iniciado");
    return;
  }

  if (!process.env.META_APP_SECRET) {
    logger.warn("TokenRefresh", "META_APP_SECRET não configurado — renovação automática desabilitada");
    return;
  }

  logger.info("TokenRefresh", "Scheduler de renovação automática iniciado (verificação a cada 24h)");

  // Verificar na inicialização (com delay de 30s para não atrasar o boot)
  setTimeout(() => {
    checkAndRefreshIfNeeded().catch((e) =>
      logger.error("TokenRefresh", "Erro na verificação inicial", e)
    );
  }, 30_000);

  // Verificar periodicamente
  refreshTimer = setInterval(() => {
    checkAndRefreshIfNeeded().catch((e) =>
      logger.error("TokenRefresh", "Erro na verificação periódica", e)
    );
  }, CHECK_INTERVAL_MS);
}

/**
 * Para o scheduler (para testes ou shutdown)
 */
export function stopTokenRefreshScheduler(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    logger.info("TokenRefresh", "Scheduler de renovação parado");
  }
}
