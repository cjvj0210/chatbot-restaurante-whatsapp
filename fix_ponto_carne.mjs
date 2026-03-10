import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

// 1. Buscar todos os grupos de ponto da carne ativos
const [groups] = await conn.execute(`
  SELECT id, name FROM menu_addon_groups 
  WHERE (name LIKE '%ponto da carne%' OR name LIKE '%Ponto da carne%') AND isActive = 1
`);

console.log(`Encontrados ${groups.length} grupos de ponto da carne`);

for (const group of groups) {
  // Verificar se já tem "Ao ponto da casa"
  const [existing] = await conn.execute(
    `SELECT id FROM menu_addon_options WHERE groupId = ? AND name LIKE '%Ao ponto%'`,
    [group.id]
  );
  
  if (existing.length === 0) {
    // Adicionar "Ao ponto da casa" como opção 3 (displayOrder = 3)
    await conn.execute(
      `INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder, isActive) VALUES (?, ?, ?, 0, 3, 1)`,
      [group.id, 'Ao ponto da casa', 'Ponto padrão da Churrascaria Estrela do Sul']
    );
    console.log(`  ✅ Adicionado "Ao ponto da casa" no grupo ${group.id} (${group.name})`);
  } else {
    console.log(`  ℹ️ Grupo ${group.id} já tem "Ao ponto" - pulando`);
  }
}

// 2. Também verificar o grupo do Tropeiro (id=10 que tem ponto da carne separado)
const [tropGroups] = await conn.execute(`
  SELECT id, name FROM menu_addon_groups 
  WHERE menuItemId = 150004 AND name LIKE '%ponto%'
`);
for (const group of tropGroups) {
  const [existing] = await conn.execute(
    `SELECT id FROM menu_addon_options WHERE groupId = ? AND name LIKE '%Ao ponto%'`,
    [group.id]
  );
  if (existing.length === 0) {
    await conn.execute(
      `INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder, isActive) VALUES (?, ?, ?, 0, 3, 1)`,
      [group.id, 'Ao ponto da casa', 'Ponto padrão da Churrascaria Estrela do Sul']
    );
    console.log(`  ✅ Adicionado "Ao ponto da casa" no grupo Tropeiro ${group.id}`);
  }
}

await conn.end();
console.log('✅ Ponto da carne padronizado!');
