/**
 * Script para verificar e corrigir minSelections nos grupos de variação de carnes
 * Remove o mínimo obrigatório — cliente pode escolher apenas 1 carne se quiser
 */
import { createConnection } from 'mysql2/promise';

// Ler DATABASE_URL do ambiente
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const conn = await createConnection(dbUrl);

// 1. Ver grupos de variação de carnes com minSelections > 0
const [grupos] = await conn.execute(`
  SELECT g.id, g.name, g.minSelections, g.maxSelections, g.isRequired, i.name as item_name 
  FROM menu_addon_groups g 
  JOIN menu_items i ON g.menuItemId = i.id 
  WHERE g.minSelections > 0
  AND (g.name LIKE '%Varie%' OR g.name LIKE '%Carne%' OR g.name LIKE '%Mix%' OR g.name LIKE '%Prefer%' OR g.name LIKE '%Alterar%')
  ORDER BY i.name, g.displayOrder
`);

console.log(`\nGrupos de variação de carnes com minSelections > 0: ${grupos.length}`);
for (const g of grupos) {
  console.log(`  ID ${g.id} | ${g.item_name} | "${g.name}" | min=${g.minSelections} max=${g.maxSelections} required=${g.isRequired}`);
}

if (grupos.length === 0) {
  // Tentar sem filtro de nome para ver todos
  const [todos] = await conn.execute(`
    SELECT g.id, g.name, g.minSelections, g.maxSelections, g.isRequired, i.name as item_name 
    FROM menu_addon_groups g 
    JOIN menu_items i ON g.menuItemId = i.id 
    WHERE g.minSelections > 0
    ORDER BY i.name, g.displayOrder
    LIMIT 20
  `);
  console.log(`\nTodos grupos com minSelections > 0 (sem filtro): ${todos.length}`);
  for (const g of todos) {
    console.log(`  ID ${g.id} | ${g.item_name} | "${g.name}" | min=${g.minSelections} max=${g.maxSelections}`);
  }
  
  // Corrigir todos que têm "Preferência" ou "Alterar" no nome
  const [result] = await conn.execute(`
    UPDATE menu_addon_groups g
    JOIN menu_items i ON g.menuItemId = i.id
    SET g.minSelections = 0
    WHERE g.minSelections > 0
    AND (g.name LIKE '%Prefer%' OR g.name LIKE '%Alterar%' OR g.name LIKE '%Varie%' OR g.name LIKE '%Carne%' OR g.name LIKE '%Mix%')
  `);
  console.log(`\nAtualizado: ${result.affectedRows} grupos corrigidos (minSelections → 0)`);
} else {
  // Corrigir: setar minSelections = 0 para todos esses grupos
  const ids = grupos.map(g => g.id);
  const placeholders = ids.map(() => '?').join(',');
  const [result] = await conn.execute(
    `UPDATE menu_addon_groups SET minSelections = 0 WHERE id IN (${placeholders})`,
    ids
  );
  console.log(`\nAtualizado: ${result.affectedRows} grupos corrigidos (minSelections → 0)`);
}

await conn.end();
console.log('\nConcluído!');
