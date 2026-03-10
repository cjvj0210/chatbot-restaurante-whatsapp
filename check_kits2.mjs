import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL || '');
// Verificar todos os grupos de Turbine dos Kits/Mixes
const [rows] = await conn.execute(`
  SELECT cg.id, cg.name, mi.name as item, COUNT(co.id) as total, SUM(co.isActive) as active
  FROM menu_addon_groups cg
  JOIN menu_items mi ON mi.id = cg.menuItemId
  LEFT JOIN menu_addon_options co ON co.groupId = cg.id
  WHERE cg.name LIKE '%Turbine%' AND cg.menuItemId IN (150020, 150021, 150022, 150023)
  GROUP BY cg.id, cg.name, mi.name
`);
for (const r of rows) {
  console.log(`[${r.id}] ${r.item} - ${r.name}: total=${r.total}, active=${r.active}`);
}
await conn.end();
