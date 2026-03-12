/**
 * Keep-Alive & Health Monitor para Evolution API
 *
 * Funcionalidades:
 * 1. Ping a cada 4 minutos para evitar hibernação do Render.com (plano gratuito)
 * 2. Verificação de estado da instância (open/close/connecting)
 * 3. Reconexão automática se desconectado
 * 4. Detecção de desconexão por código 401 (logout) e notificação ao dono
 * 5. Reconfiguração automática do webhook se necessário
 * 6. Retry com backoff em caso de cold start do Render
 */

import axios from "axios";
import { notifyOwner } from "./_core/notification";

const PING_INTERVAL_MS = 4 * 60 * 1000; // 4 minutos (mais agressivo para evitar hibernação)
const INITIAL_DELAY_MS = 10000; // 10 segundos após iniciar
const WEBHOOK_CHECK_INTERVAL_MS = 15 * 60 * 1000; // Verificar webhook a cada 15 min

let lastSuccessfulPing = Date.now();
let consecutiveFailures = 0;
let lastDisconnectionNotified = "";

function getEvolutionConfig() {
  return {
    baseUrl: process.env.EVOLUTION_API_URL || "",
    apiKey: process.env.EVOLUTION_API_KEY || "",
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || "teste",
  };
}

function getWebhookUrl(): string {
  // Usar o domínio publicado
  const siteUrl = process.env.SITE_DEV_URL || "https://chatbotwa-hesngyeo.manus.space";
  return `${siteUrl}/api/webhook/evolution`;
}

/**
 * Verificação principal: ping + estado + reconexão
 */
async function checkAndReconnect(): Promise<void> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig();

  if (!baseUrl || !apiKey) {
    return;
  }

  try {
    // Ping 1: GET na raiz para "aquecer" o Render
    await axios.get(baseUrl, { timeout: 10000 }).catch(() => {});

    // Ping 2: Verificar estado da instância
    const response = await axios.get(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        headers: { apikey: apiKey },
        timeout: 15000,
      }
    );

    const state = response.data?.instance?.state;
    console.log(`[KeepAlive] Estado: ${state} | Falhas consecutivas: ${consecutiveFailures}`);

    lastSuccessfulPing = Date.now();
    consecutiveFailures = 0;

    if (state === "open") {
      return; // Tudo OK
    }

    // Instância desconectada — tentar reconectar
    console.warn(`[KeepAlive] Instância desconectada (${state}), tentando reconectar...`);

    // Verificar detalhes da desconexão
    try {
      const instanceInfo = await axios.get(
        `${baseUrl}/instance/fetchInstances`,
        {
          headers: { apikey: apiKey },
          timeout: 15000,
        }
      );

      const instance = Array.isArray(instanceInfo.data)
        ? instanceInfo.data.find((i: any) => i.name === instanceName)
        : null;

      if (instance) {
        const disconnectCode = instance.disconnectionReasonCode;
        const disconnectAt = instance.disconnectionAt;

        // Notificar sobre desconexão (apenas uma vez por evento)
        const disconnectKey = `${disconnectCode}-${disconnectAt}`;
        if (disconnectKey !== lastDisconnectionNotified) {
          lastDisconnectionNotified = disconnectKey;

          const reason = disconnectCode === 401
            ? "Sessão do WhatsApp foi encerrada (logout). Pode ter sido aberto em outro dispositivo ou a sessão expirou."
            : disconnectCode === 408
              ? "Timeout de conexão. O servidor pode ter ficado sem internet temporariamente."
              : `Código de desconexão: ${disconnectCode}`;

          console.error(`[KeepAlive] Desconexão detectada: ${reason} | Em: ${disconnectAt}`);

          // Notificar o dono
          await notifyOwner({
            title: "⚠️ Bot WhatsApp Desconectado",
            content: `O bot do WhatsApp desconectou.\n\nMotivo: ${reason}\nHorário: ${disconnectAt}\n\nTentando reconectar automaticamente. Se não funcionar, acesse o painel da Evolution API e reconecte manualmente.`,
          }).catch(() => {});
        }
      }
    } catch {
      // Ignorar erro ao buscar detalhes
    }

    // Tentar reconectar
    try {
      await axios.get(`${baseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: apiKey },
        timeout: 15000,
      });
      console.log(`[KeepAlive] Reconexão solicitada com sucesso`);
    } catch (reconnectErr: any) {
      console.error(`[KeepAlive] Falha na reconexão:`, reconnectErr?.message);
    }
  } catch (error: any) {
    consecutiveFailures++;

    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.response?.status === 502) {
      console.log(`[KeepAlive] Render.com em cold start (falha #${consecutiveFailures}), aguardando...`);

      // Retry com backoff: 15s, 30s, 60s
      const retryDelay = Math.min(15000 * consecutiveFailures, 60000);
      setTimeout(async () => {
        try {
          const cfg = getEvolutionConfig();
          const resp = await axios.get(
            `${cfg.baseUrl}/instance/connectionState/${cfg.instanceName}`,
            {
              headers: { apikey: cfg.apiKey },
              timeout: 15000,
            }
          );
          console.log(`[KeepAlive] Render acordou após retry: ${resp.data?.instance?.state}`);
          consecutiveFailures = 0;
        } catch {
          console.warn(`[KeepAlive] Render ainda não respondeu no retry #${consecutiveFailures}`);
        }
      }, retryDelay);

      // Se muitas falhas consecutivas, notificar
      if (consecutiveFailures >= 3) {
        await notifyOwner({
          title: "🔴 Evolution API Indisponível",
          content: `A Evolution API no Render não está respondendo há ${consecutiveFailures} tentativas (${Math.round(consecutiveFailures * 4)} minutos).\n\nO bot WhatsApp está FORA DO AR.\n\nVerifique o painel do Render: https://dashboard.render.com`,
        }).catch(() => {});
      }
    } else {
      console.error(`[KeepAlive] Erro inesperado:`, error?.message);
    }
  }
}

/**
 * Verificação periódica do webhook: garante que está configurado e acessível
 */
async function checkWebhook(): Promise<void> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig();

  if (!baseUrl || !apiKey) return;

  try {
    // Buscar configuração atual do webhook
    const response = await axios.get(
      `${baseUrl}/webhook/find/${instanceName}`,
      {
        headers: { apikey: apiKey },
        timeout: 15000,
      }
    );

    const webhook = response.data;
    const expectedUrl = getWebhookUrl();

    if (!webhook || !webhook.enabled || webhook.url !== expectedUrl) {
      console.warn(`[KeepAlive] Webhook desconfigurado, reconfigurando...`);
      console.warn(`[KeepAlive] Atual: ${webhook?.url} | Esperado: ${expectedUrl}`);

      await axios.post(
        `${baseUrl}/webhook/set/${instanceName}`,
        {
          webhook: {
            url: expectedUrl,
            enabled: true,
            events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
            webhookByEvents: false,
            webhookBase64: false,
          },
        },
        {
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          timeout: 15000,
        }
      );
      console.log(`[KeepAlive] Webhook reconfigurado com sucesso`);
    } else {
      console.log(`[KeepAlive] Webhook OK: ${webhook.url} (enabled: ${webhook.enabled})`);
    }
  } catch (error: any) {
    console.error(`[KeepAlive] Erro ao verificar webhook:`, error?.message);
  }
}

export function startKeepAlive(): void {
  const { baseUrl } = getEvolutionConfig();

  if (!baseUrl) {
    console.log("[KeepAlive] EVOLUTION_API_URL não configurado, keep-alive desativado");
    return;
  }

  console.log(`[KeepAlive] Iniciado — ping a cada ${PING_INTERVAL_MS / 60000} min | webhook check a cada ${WEBHOOK_CHECK_INTERVAL_MS / 60000} min`);

  // Primeiro ping após 10 segundos
  setTimeout(() => {
    checkAndReconnect();
    checkWebhook();
  }, INITIAL_DELAY_MS);

  // Pings periódicos a cada 4 minutos
  setInterval(() => {
    checkAndReconnect();
  }, PING_INTERVAL_MS);

  // Verificação do webhook a cada 15 minutos
  setInterval(() => {
    checkWebhook();
  }, WEBHOOK_CHECK_INTERVAL_MS);
}
