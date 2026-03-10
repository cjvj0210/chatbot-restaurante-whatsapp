import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL || '');
const [rows] = await conn.execute(`
  SELECT co.id, co.name, co.priceExtra, cg.id as gid, mi.name as item
  FROM menu_addon_options co
  JOIN menu_addon_groups cg ON cg.id = co.groupId
  JOIN menu_items mi ON mi.id = cg.menuItemId
  WHERE cg.name LIKE '%Turbine%' AND co.isActive = 1
  ORDER BY mi.id, cg.id, co.displayOrder
`);
let lastItem = null;
for (const r of rows) {
  if (r.item !== lastItem) { console.log(`\n${r.item} [grupo ${r.gid}]`); lastItem = r.item; }
  const price = r.priceExtra > 0 ? `+R$${(r.priceExtra/100).toFixed(2)}` : 'grátis';
  console.log(`  [${r.id}] ${r.name} (${price})`);
}
await conn.end();
