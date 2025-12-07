import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema";

async function testSend() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: "default" });

  // Buscar configurações do WhatsApp
  const [settings] = await db.select().from(schema.whatsappSettings);

  if (!settings) {
    console.error("❌ Configurações do WhatsApp não encontradas!");
    process.exit(1);
  }

  console.log("📱 Configurações do WhatsApp:");
  console.log("- Phone Number ID:", settings.phoneNumberId);
  console.log("- Access Token:", settings.accessToken ? `${settings.accessToken.substring(0, 20)}...` : "NÃO CONFIGURADO");
  console.log("- Ativo:", settings.isActive);
  console.log("");

  if (!settings.isActive) {
    console.error("❌ Chatbot está DESATIVADO!");
    await connection.end();
    process.exit(1);
  }

  // Número do destinatário
  const recipientPhone = process.argv[2] || "5517982222790";
  
  console.log(`🚀 Enviando mensagem de teste para ${recipientPhone}...`);

  const url = `https://graph.facebook.com/v21.0/${settings.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: recipientPhone,
    type: "text",
    text: {
      body: "🤖 Teste de conexão do Chatbot Estrela do Sul! Se você recebeu esta mensagem, a API está funcionando! ✅"
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
      console.log("📬 Response:", JSON.stringify(data, null, 2));
    } else {
      console.error("❌ Erro ao enviar mensagem:");
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error("❌ Erro na requisição:", error.message);
  }

  await connection.end();
}

testSend();
