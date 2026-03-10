import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL || '');
const [rows] = await conn.execute(`
  SELECT co.id, co.name, cg.id as gid, mi.name as item
  FROM menu_addon_options co
  JOIN menu_addon_groups cg ON cg.id = co.groupId
  JOIN menu_items mi ON mi.id = cg.menuItemId
  WHERE cg.name LIKE '%ponto da carne%' AND co.isActive = 1
  ORDER BY cg.id, co.displayOrder
`);
let lastGid = null;
for (const r of rows) {
  if (r.gid !== lastGid) { console.log(`\n[${r.gid}] ${r.item}`); lastGid = r.gid; }
  console.log(`  - ${r.name}`);
}
await conn.end();
