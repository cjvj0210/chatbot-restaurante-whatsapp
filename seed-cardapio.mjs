import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./drizzle/schema.ts";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function seedCardapio() {
  console.log("Populando banco de dados com cardápio completo...\n");

  // Criar categorias
  const categories = [
    { name: "Marmitex", description: "Marmitex tradicionais de churrasco", displayOrder: 1 },
    { name: "Marmitas Simples", description: "Marmitas de arroz e feijão", displayOrder: 2 },
    { name: "Guarnições", description: "Acompanhamentos e porções", displayOrder: 3 },
    { name: "Salgados", description: "Pastéis e salgados", displayOrder: 4 },
    { name: "Mix e Kits de Churrasco", description: "Kits e mix de carnes nobres", displayOrder: 5 },
    { name: "Pratos Executivos", description: "Pratos executivos completos", displayOrder: 6 },
    { name: "Saladas", description: "Saladas frescas", displayOrder: 7 },
    { name: "Bebidas", description: "Refrigerantes, sucos e águas", displayOrder: 8 },
  ];

  const categoryIds = {};
  for (const cat of categories) {
    const [result] = await db.insert(schema.menuCategories).values(cat);
    categoryIds[cat.name] = result.insertId;
    console.log(`✅ Categoria criada: ${cat.name}`);
  }

  // Itens do cardápio (versão simplificada - principais itens)
  const items = [
    // Marmitex
    { categoryId: categoryIds["Marmitex"], name: "Marmitex G", description: "Serve 2 pessoas. Aprox. 950g. Arroz, feijão, farofa, vinagrete, 1 frango, 1 linguiça, carne bovina (fraldinha, cupim ou maminha)", price: 34.00, available: true },
    { categoryId: categoryIds["Marmitex"], name: "Marmitex M", description: "Serve de 1 a 2 pessoas. Aprox. 880g. Arroz, feijão, farofa, vinagrete e maionese", price: 30.00, available: true },
    { categoryId: categoryIds["Marmitex"], name: "Marmitex P", description: "Serve 1 pessoa. Aprox. 720g. Arroz, feijão, farofa, vinagrete, batata frita, 1 frango, 1 linguiça, carne bovina", price: 26.00, available: true },
    { categoryId: categoryIds["Marmitex"], name: "Marmitex Econômico", description: "Serve 1 pessoa. Aprox. 650g. Arroz, feijão, farofa, maionese e vinagrete", price: 20.00, available: true },
    
    // Marmitas Simples
    { categoryId: categoryIds["Marmitas Simples"], name: "Marmita de Arroz e Feijão", description: "Arroz branco e feijão", price: 17.00, available: true },
    { categoryId: categoryIds["Marmitas Simples"], name: "Marmita só de Arroz", description: "Apenas arroz branco", price: 17.00, available: true },
    { categoryId: categoryIds["Marmitas Simples"], name: "Marmita só de Feijão", description: "Apenas feijão", price: 17.00, available: true },
    
    // Guarnições
    { categoryId: categoryIds["Guarnições"], name: "Mandioca Frita Grande", description: "Porção grande de mandioca frita", price: 21.90, available: true },
    { categoryId: categoryIds["Guarnições"], name: "Mandioca Frita Pequena", description: "Porção pequena de mandioca frita", price: 10.90, available: true },
    { categoryId: categoryIds["Guarnições"], name: "Batata Chips Grande", description: "Porção grande de batata chips", price: 21.90, available: true },
    { categoryId: categoryIds["Guarnições"], name: "Batata Chips Pequena", description: "Porção pequena de batata chips", price: 9.90, available: true },
    { categoryId: categoryIds["Guarnições"], name: "Nuggets de Frango Grande", description: "Porção grande de nuggets", price: 21.90, available: true },
    { categoryId: categoryIds["Guarnições"], name: "Nuggets de Frango Pequeno", description: "Porção pequena de nuggets", price: 10.90, available: true },
    { categoryId: categoryIds["Guarnições"], name: "Anéis de Cebola Grande", description: "Porção grande de anéis de cebola empanados", price: 24.90, available: true },
    { categoryId: categoryIds["Guarnições"], name: "Anéis de Cebola Pequena", description: "Porção pequena de anéis de cebola empanados", price: 11.90, available: true },
    
    // Salgados
    { categoryId: categoryIds["Salgados"], name: "Mini Pastéis 10 unidades", description: "10 unidades. Escolha entre: carne, catupiry, queijo ou romeu e julieta", price: 21.90, available: true },
    { categoryId: categoryIds["Salgados"], name: "Mini Pastéis 4 unidades", description: "4 unidades. Escolha entre: carne, catupiry, queijo ou romeu e julieta", price: 13.90, available: true },
    { categoryId: categoryIds["Salgados"], name: "Banana Empanada 8 unidades", description: "8 unidades de banana empanada", price: 25.90, available: true },
    { categoryId: categoryIds["Salgados"], name: "Banana Empanada 2 unidades", description: "2 unidades de banana empanada", price: 8.50, available: true },
    
    // Mix e Kits
    { categoryId: categoryIds["Mix e Kits de Churrasco"], name: "Mix Churrasco Tradicional", description: "Mix com 4 opções de churrasco (600g). Serve de 2 a 3 pessoas. Acompanha 1 potinho de vinagrete e 1 potinho de farofa", price: 75.00, available: true },
    { categoryId: categoryIds["Mix e Kits de Churrasco"], name: "Mix Churrasco Nobre", description: "Escolha 4 tipos de Carnes (Javali, Picanha, Maminha, Queijinho, Bife Ancho, Filé Mignon, Carré de Carneiro, Linguiça Cuiabana) + 1 potinho de vinagrete e 1 potinho de farofa. Serve de 2 a 3 pessoas", price: 115.00, available: true },
    { categoryId: categoryIds["Mix e Kits de Churrasco"], name: "Kit Churrasco Tradicional p/3 pessoas", description: "1 kg. Churrasco à moda: Costelão bovino, Cupim especial, Maminha com queijo, Fraldinha, Linguiça cuiabana", price: 169.90, available: true },
    { categoryId: categoryIds["Mix e Kits de Churrasco"], name: "Kit Churrasco Tradicional p/5 pessoas", description: "1,5 kg. Churrasco à moda: Costelão bovino, Cupim especial, Maminha com queijo, Fraldinha, Linguiça cuiabana", price: 239.90, available: true },
    { categoryId: categoryIds["Mix e Kits de Churrasco"], name: "Kit Churrasco Nobre p/3 pessoas", description: "1 kg de churrasco a moda (Picanha, Filé mignon, Ancho argentino, T-bone de cordeiro, Linguiça cuiabana recheada, Baby beef, Javali) + Acompanhamentos", price: 214.90, available: true },
    { categoryId: categoryIds["Mix e Kits de Churrasco"], name: "Kit Churrasco Nobre p/5 pessoas", description: "1,5 kg de churrasco a moda (Picanha, Filé mignon, Ancho argentino, T-bone de cordeiro, Linguiça cuiabana recheada, Baby beef, Javali) + Acompanhamentos", price: 294.90, available: true },
    
    // Pratos Executivos
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Estrelinha", description: "Polenta Frita ou Batata Frita + Estrogonoff de Carne ou Frango", price: 29.90, available: true },
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Peãozinho", description: "Batata Sorriso ou Batata Chips + Nuggets Caseiro ou Frango Empanado", price: 29.90, available: true },
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Tropeiro", description: "Costela no bafo ou Cupim filetado + Arroz biro biro + Feijão tropeiro + Couve refogada", price: 40.90, available: true },
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Cowboy", description: "Fraldinha ou Maminha ou Cupim + Arroz biro biro + Batata chips ou Mandioca + Vinagrete", price: 40.90, available: true },
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Fit", description: "Frango ou Alcatra ou Lombo suíno + Mandioca cozida + Salada", price: 36.90, available: true },
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Laçador (Filé Mignon)", description: "Filé com catupiry + Arroz branco + Feijão + Batata chips ou Mandioca", price: 51.90, available: true },
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Laçador (Contra Filé)", description: "Contra filé com catupiry + Arroz branco + Feijão + Batata chips ou Mandioca", price: 42.90, available: true },
    { categoryId: categoryIds["Pratos Executivos"], name: "Executivo Pescador", description: "Salmão grelhado ao molho de maracujá + Arroz branco + Legumes", price: 45.90, available: true },
    
    // Saladas
    { categoryId: categoryIds["Saladas"], name: "Salada Simples", description: "Rúcula, alface, tomate e cebola (molho caesar, italiano ou azeite)", price: 20.00, available: true },
    { categoryId: categoryIds["Saladas"], name: "Alface Americana", description: "Fresca, croutons caseiros e lascas de parmesão", price: 24.00, available: true },
    
    // Bebidas (principais)
    { categoryId: categoryIds["Bebidas"], name: "Coca-Cola 2L", description: "Refrigerante", price: 15.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Coca-Cola Zero 2L", description: "Refrigerante", price: 15.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Coca-Cola 350ml", description: "Refrigerante lata", price: 11.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Guaraná Antarctica 2L", description: "Refrigerante", price: 13.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Guaraná Antarctica Lata", description: "Refrigerante 350ml", price: 7.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Fanta Laranja 2L", description: "Refrigerante", price: 13.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Fanta Uva 2L", description: "Refrigerante", price: 13.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Sprite Lata", description: "Refrigerante 350ml", price: 7.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Del Valle Lata", description: "Suco lata 290ml (uva, pêssego, maracujá, goiaba, manga)", price: 6.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Suco Abacaxi", description: "Garrafa 500ml", price: 12.00, available: true },
    { categoryId: categoryIds["Bebidas"], name: "Água com Gás Crystal", description: "510ml", price: 6.50, available: true },
  ];

  let count = 0;
  for (const item of items) {
    await db.insert(schema.menuItems).values(item);
    count++;
  }

  console.log(`\n✅ ${count} itens cadastrados no cardápio!`);
  console.log("\nResumo:");
  console.log(`- Marmitex: 4 opções`);
  console.log(`- Marmitas Simples: 3 opções`);
  console.log(`- Guarnições: 8 opções`);
  console.log(`- Salgados: 4 opções`);
  console.log(`- Mix e Kits: 6 opções`);
  console.log(`- Pratos Executivos: 8 opções`);
  console.log(`- Saladas: 2 opções`);
  console.log(`- Bebidas: 11 principais`);
  
  process.exit(0);
}

seedCardapio().catch((error) => {
  console.error("Erro ao popular cardápio:", error);
  process.exit(1);
});
