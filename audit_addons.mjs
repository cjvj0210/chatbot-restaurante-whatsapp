import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

// Buscar TODOS os grupos e opções de todos os itens
const [rows] = await conn.execute(`
  SELECT 
    mi.id as item_id, mi.name as item_name,
    cg.id as group_id, cg.name as group_name, cg.isRequired, cg.displayOrder as g_order,
    co.id as opt_id, co.name as opt_name, co.priceExtra
  FROM menu_items mi
  JOIN menu_addon_groups cg ON cg.menuItemId = mi.id
  JOIN menu_addon_options co ON co.groupId = cg.id
  ORDER BY mi.id, cg.displayOrder, co.displayOrder
`);

// Agrupar por item
const byItem = {};
for (const row of rows) {
  if (!byItem[row.item_name]) byItem[row.item_name] = {};
  if (!byItem[row.item_name][row.group_name]) {
    byItem[row.item_name][row.group_name] = { gId: row.group_id, required: row.isRequired, opts: [] };
  }
  byItem[row.item_name][row.group_name].opts.push({ id: row.opt_id, name: row.opt_name, price: row.priceExtra });
}

// Imprimir resumo
for (const [item, groups] of Object.entries(byItem)) {
  console.log(`\n=== ${item} ===`);
  for (const [group, data] of Object.entries(groups)) {
    console.log(`  [${data.gId}] ${group} (req=${data.required})`);
    for (const opt of data.opts) {
      const price = opt.price > 0 ? `+R$${(opt.price/100).toFixed(2)}` : 'grátis';
      console.log(`    [${opt.id}] ${opt.name} (${price})`);
    }
  }
}

await conn.end();
