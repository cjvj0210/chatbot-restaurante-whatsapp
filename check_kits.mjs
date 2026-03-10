import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL || '');
const [rows] = await conn.execute(`
  SELECT cg.id as gid, mi.name as item, co.id, co.name, co.priceExtra, co.isActive
  FROM menu_addon_groups cg
  JOIN menu_items mi ON mi.id = cg.menuItemId
  JOIN menu_addon_options co ON co.groupId = cg.id
  WHERE cg.name LIKE '%Turbine%' AND cg.menuItemId IN (150020, 150021, 150022, 150023)
  ORDER BY cg.id, co.id
`);
let lastItem = null;
for (const r of rows) {
  if (r.item !== lastItem) { console.log(`\n${r.item} [grupo ${r.gid}]`); lastItem = r.item; }
  const price = r.priceExtra > 0 ? `+R$${(r.priceExtra/100).toFixed(2)}` : 'grátis';
  const status = r.isActive ? '✅' : '❌';
  console.log(`  ${status} [${r.id}] ${r.name} (${price})`);
}
await conn.end();
