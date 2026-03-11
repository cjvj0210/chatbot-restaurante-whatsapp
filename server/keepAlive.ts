/**
 * Keep-Alive Service para Evolution API no Render.com (plano gratuito)
 *
 * O plano gratuito do Render.com hiberna após 15 minutos de inatividade,
 * perdendo a sessão do WhatsApp. Este serviço faz ping a cada 10 minutos
 * para manter o serviço acordado e reconecta automaticamente se necessário.
 */

import axios from "axios";

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const RECONNECT_DELAY_MS = 5000; // 5 segundos após detectar desconexão

function getEvolutionConfig() {
  return {
    baseUrl: process.env.EVOLUTION_API_URL || "",
    apiKey: process.env.EVOLUTION_API_KEY || "",
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || "teste",
  };
}

async function checkAndReconnect(): Promise<void> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig();

  if (!baseUrl || !apiKey) {
    return; // Evolution API não configurada, ignorar
  }

  try {
    const response = await axios.get(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        headers: { apikey: apiKey },
        timeout: 15000,
      }
    );

    const state = response.data?.instance?.state;
    console.log(`[KeepAlive] Estado da instância: ${state}`);

    if (state !== "open") {
      console.log(`[KeepAlive] Instância desconectada (${state}), reconectando...`);
      await axios.get(`${baseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: apiKey },
        timeout: 15000,
      });
      console.log(`[KeepAlive] Reconexão solicitada`);
    }
  } catch (error: any) {
    // Se o Render.com está em cold start, o ping em si já acorda o serviço
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.response?.status === 502) {
      console.log(`[KeepAlive] Render.com em cold start, aguardando acordar...`);
    } else {
      console.error(`[KeepAlive] Erro ao verificar estado:`, error?.message);
    }
  }
}

export function startKeepAlive(): void {
  const { baseUrl } = getEvolutionConfig();

  if (!baseUrl) {
    console.log("[KeepAlive] EVOLUTION_API_URL não configurado, keep-alive desativado");
    return;
  }

  console.log(`[KeepAlive] Iniciado — ping a cada ${PING_INTERVAL_MS / 60000} minutos`);

  // Primeiro ping após 30 segundos (dar tempo para o servidor iniciar)
  setTimeout(() => {
    checkAndReconnect();
  }, 30000);

  // Pings periódicos a cada 10 minutos
  setInterval(() => {
    checkAndReconnect();
  }, PING_INTERVAL_MS);
}
