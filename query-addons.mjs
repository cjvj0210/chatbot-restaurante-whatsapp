import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.log('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(url);

// Grupos das marmitex P (150008), M (150009), G (150010)
const [groups] = await conn.query(
  'SELECT g.id, g.menuItemId, g.name, g.maxSelections, g.displayOrder, g.isRequired, g.isActive FROM menu_addon_groups g WHERE g.menuItemId IN (150008, 150009, 150010) ORDER BY g.menuItemId, g.displayOrder'
);

console.log('\n=== GRUPOS DE ADICIONAIS ===');
for (const g of groups) {
  console.log(`\nGroupID:${g.id} | itemId:${g.menuItemId} | displayOrder:${g.displayOrder} | name:"${g.name}" | max:${g.maxSelections} | required:${g.isRequired} | active:${g.isActive}`);
  
  const [opts] = await conn.query(
    'SELECT id, name, priceExtra, isActive, displayOrder FROM menu_addon_options WHERE groupId = ? ORDER BY displayOrder, id',
    [g.id]
  );
  for (const o of opts) {
    console.log(`  OptionID:${o.id} | "${o.name}" | priceExtra:${o.priceExtra} | active:${o.isActive}`);
  }
}

await conn.end();
