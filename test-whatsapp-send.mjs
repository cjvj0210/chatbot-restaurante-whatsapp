import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.js";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema });

// Buscar configurações do WhatsApp
const [settings] = await db.select().from(schema.whatsappSettings);

if (!settings) {
  console.error("❌ Configurações do WhatsApp não encontradas!");
  process.exit(1);
}

console.log("📱 Configurações do WhatsApp:");
console.log("- Phone Number ID:", settings.phoneNumberId);
console.log("- Access Token:", settings.accessToken ? `${settings.accessToken.substring(0, 20)}...` : "NÃO CONFIGURADO");
console.log("- Webhook Verify Token:", settings.webhookVerifyToken ? "CONFIGURADO" : "NÃO CONFIGURADO");
console.log("- Ativo:", settings.isActive);
console.log("");

if (!settings.isActive) {
  console.error("❌ Chatbot está DESATIVADO! Ative nas configurações.");
  process.exit(1);
}

// Testar envio de mensagem
const recipientPhone = process.argv[2];
if (!recipientPhone) {
  console.error("❌ Uso: node test-whatsapp-send.mjs <número_destinatário>");
  console.error("   Exemplo: node test-whatsapp-send.mjs 5517982222790");
  process.exit(1);
}

console.log(`🚀 Enviando mensagem de teste para ${recipientPhone}...`);

const url = `https://graph.facebook.com/v21.0/${settings.phoneNumberId}/messages`;
const payload = {
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "text",
  text: {
    body: "🤖 Teste de conexão do Chatbot Estrela do Sul! Se você recebeu esta mensagem, a API está funcionando corretamente! ✅"
  }
};

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ Mensagem enviada com sucesso!");
    console.log("📬 Message ID:", data.messages[0].id);
    console.log("");
    console.log("🎉 SUCESSO! Verifique o WhatsApp do destinatário!");
  } else {
    console.error("❌ Erro ao enviar mensagem:");
    console.error(JSON.stringify(data, null, 2));
  }
} catch (error) {
  console.error("❌ Erro na requisição:", error.message);
}

await connection.end();
