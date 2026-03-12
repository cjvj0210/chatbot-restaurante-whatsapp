import axios from "axios";

const baseUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

// Normalizar telefone
const rawPhone = "(17) 98811-2791";
const digits = rawPhone.replace(/\D/g, "");
const normalized = digits.startsWith("55") ? digits : "55" + digits;
console.log("Telefone normalizado:", normalized);

try {
  const resp = await axios.post(
    `${baseUrl}/message/sendText/${instanceName}`,
    { number: normalized, text: "[Retry Worker] Teste de envio de notificacao pendente" },
    { headers: { apikey: apiKey }, timeout: 15000 }
  );
  console.log("Resposta:", JSON.stringify(resp.data).substring(0, 200));
} catch (err) {
  console.error("Erro:", err.message);
  if (err.response) console.error("Response:", JSON.stringify(err.response.data).substring(0, 200));
}
