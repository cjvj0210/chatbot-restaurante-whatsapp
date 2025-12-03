import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.ts";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection, { schema, mode: "default" });

console.log("🌟 Populando banco de dados da Churrascaria Estrela do Sul...\n");

// 1. Configurações do Restaurante
console.log("1️⃣ Configurando informações do restaurante...");
await db.insert(schema.restaurantSettings).values({
  name: "Churrascaria Estrela do Sul",
  phone: "(17) 98222-2790",
  address: "Av. Eng. Necker Carmago de Carvalho, Rua 36, 1885 - Barretos/SP",
  openingHours: `Almoço: Todos os dias 11h-15h
Jantar: Terça a Domingo 19h-22h45
Fechado: Segunda à noite`,
  acceptsDelivery: true,
  acceptsReservation: true,
  deliveryFee: 700, // R$ 7,00
  minimumOrder: 2000, // R$ 20,00
  paymentMethods: "Dinheiro, PIX, Cartão, Vale-Refeição",
}).onDuplicateKeyUpdate({ set: { name: "Churrascaria Estrela do Sul" } });

console.log("✅ Informações do restaurante configuradas\n");

// 2. Configurações do WhatsApp (placeholder)
console.log("2️⃣ Configurando WhatsApp (placeholder)...");
await db.insert(schema.whatsappSettings).values({
  phoneNumberId: "PENDING_CONFIGURATION",
  accessToken: "PENDING_CONFIGURATION",
  webhookVerifyToken: "estrela_do_sul_2024",
  businessAccountId: null,
  isActive: false,
}).onDuplicateKeyUpdate({ set: { phoneNumberId: "PENDING_CONFIGURATION" } });

console.log("✅ WhatsApp configurado (aguardando credenciais reais)\n");

// 3. Categorias do Cardápio
console.log("3️⃣ Criando categorias do cardápio...");

const categories = [
  { name: "Rodízio", description: "Rodízio completo com carnes nobres, buffet e sobremesas", displayOrder: 1 },
  { name: "Marmitex", description: "Marmitex de churrasco tradicional", displayOrder: 2 },
  { name: "Pratos Executivos", description: "Pratos executivos variados", displayOrder: 3 },
  { name: "Kits de Carne", description: "Kits especiais de carnes selecionadas", displayOrder: 4 },
  { name: "Guarnições", description: "Acompanhamentos e guarnições", displayOrder: 5 },
  { name: "Bebidas", description: "Refrigerantes, sucos e outras bebidas", displayOrder: 6 },
  { name: "Adicionais", description: "Itens adicionais para complementar seu pedido", displayOrder: 7 },
];

for (const cat of categories) {
  await db.insert(schema.menuCategories).values(cat).onDuplicateKeyUpdate({ set: { name: cat.name } });
}

console.log("✅ 7 categorias criadas\n");

// 4. Itens do Rodízio (informação, não para delivery)
console.log("4️⃣ Adicionando informações do rodízio...");

const rodizioCategory = await db.query.menuCategories.findFirst({
  where: (categories, { eq }) => eq(categories.name, "Rodízio"),
});

if (rodizioCategory) {
  const rodizioItems = [
    {
      categoryId: rodizioCategory.id,
      name: "Rodízio Almoço (Seg-Sex)",
      description: "Rodízio completo. Bebidas e taxa de serviço à parte.",
      price: 11990, // R$ 119,90
      preparationTime: 0,
      isAvailable: true,
    },
    {
      categoryId: rodizioCategory.id,
      name: "Rodízio Almoço (Sáb-Dom)",
      description: "Rodízio completo. Bebidas e taxa de serviço à parte.",
      price: 12990, // R$ 129,90
      preparationTime: 0,
      isAvailable: true,
    },
    {
      categoryId: rodizioCategory.id,
      name: "Rodízio Jantar Individual",
      description: "Rodízio completo. Bebidas e taxa de serviço à parte.",
      price: 10990, // R$ 109,90
      preparationTime: 0,
      isAvailable: true,
    },
    {
      categoryId: rodizioCategory.id,
      name: "Rodízio Jantar Casal (PROMOÇÃO)",
      description: "Duas pessoas à vontade! Rodízio completo. Bebidas e taxa à parte.",
      price: 19990, // R$ 199,90
      preparationTime: 0,
      isAvailable: true,
    },
  ];

  for (const item of rodizioItems) {
    await db.insert(schema.menuItems).values(item);
  }

  console.log("✅ 4 opções de rodízio adicionadas\n");
}

// 5. Placeholder para itens de delivery
console.log("5️⃣ Criando placeholders para delivery...");

const bebidasCategory = await db.query.menuCategories.findFirst({
  where: (categories, { eq }) => eq(categories.name, "Bebidas"),
});

if (bebidasCategory) {
  await db.insert(schema.menuItems).values({
    categoryId: bebidasCategory.id,
    name: "Coca-Cola 2L",
    description: "Refrigerante Coca-Cola 2 litros",
    price: 1000, // R$ 10,00 (placeholder)
    preparationTime: 5,
    isAvailable: true,
  });
}

console.log("✅ Placeholder de bebida criado\n");
console.log("📝 ATENÇÃO: Cardápio de delivery será preenchido amanhã\n");

console.log("🎉 Banco de dados populado com sucesso!");
console.log("🌟 Churrascaria Estrela do Sul está pronta!\n");

await connection.end();
