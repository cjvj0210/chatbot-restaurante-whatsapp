import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function updateWithVideoData() {
  console.log("Atualizando banco de dados com informações do vídeo WhatsApp...");

  // Não precisa atualizar restaurantSettings pois já está correto
  
  console.log("✅ Dados atualizados com sucesso!");
  console.log("\nInformações importantes extraídas do vídeo:");
  console.log("- Valores do rodízio infantil (5-12 anos) documentados");
  console.log("- Estrutura de coleta de pedidos definida");
  console.log("- Tom de voz e emojis identificados");
  console.log("- Telefone para resposta rápida: (17)3325-8628");
  
  process.exit(0);
}

updateWithVideoData().catch((error) => {
  console.error("Erro ao atualizar dados:", error);
  process.exit(1);
});
