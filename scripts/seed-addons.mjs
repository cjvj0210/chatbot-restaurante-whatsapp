/**
 * Script para cadastrar todos os grupos e opções de complementos
 * baseado no cardápio do iFood da Churrascaria Estrela do Sul
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

// IDs dos itens (conforme cadastro no banco)
const ITEMS = {
  COWBOY: 150001,
  FIT: 150002,
  LACADOR: 150003,
  TROPEIRO: 150004,
  PESCADOR: 150005,
  PEAOZINHO: 150006,
  ESTRELINHA: 150007,
  MARMITEX_P: 150008,
  MARMITEX_M: 150009,
  MARMITEX_G: 150010,
  BANANA_EMPANADA: 150011,
  MINI_PASTEIS: 150012,
  QUEIJINHO: 150013,
  ANEIS_CEBOLA: 150014,
  NUGGETS: 150015,
  BATATA_CHIPS: 150016,
  BATATA_FRITA: 150017,
  ARROZ: 150018,
  MARMITEX_ECO: 150019,
  KIT_NOBRE: 150020,
  KIT_TRAD: 150021,
  MIX_NOBRE: 150022,
  MIX_TRAD: 150023,
  SALADA_CAPRESE: 150024,
  SALADA_SIMPLES: 150025,
  SALADA_CAESAR: 150026,
  SALADA_ESTRELA: 150027,
  REFRI_2L: 150028,
  REFRI_ECO: 150029,
  SUCO_ABACAXI: 150030,
  SUCO_LARANJA: 150031,
  SUCO_DELVALLE: 150032,
  REFRI_LATA: 150033,
  SUCO_LIMAO: 150034,
  AGUA: 150035,
  CERVEJA_LONGNECK: 150036,
  CERVEJA_LATA: 150037,
};

async function insertGroup(menuItemId, name, description, isRequired, minSelections, maxSelections, displayOrder) {
  const [res] = await conn.execute(
    'INSERT INTO menu_addon_groups (menuItemId, name, description, isRequired, minSelections, maxSelections, displayOrder, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [menuItemId, name, description || null, isRequired ? 1 : 0, minSelections, maxSelections, displayOrder]
  );
  return res.insertId;
}

async function insertOption(groupId, name, description, priceExtra, displayOrder) {
  await conn.execute(
    'INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder, isActive) VALUES (?, ?, ?, ?, ?, 1)',
    [groupId, name, description || null, priceExtra, displayOrder]
  );
}

console.log('Iniciando cadastro de complementos...');

// ============================================================
// GRUPOS REUTILIZÁVEIS (aplicados a múltiplos itens)
// ============================================================

// Itens que têm "Escolha as carnes" (1 opção obrigatória)
const CARNES_EXECUTIVOS = [ITEMS.COWBOY, ITEMS.TROPEIRO];
for (const itemId of CARNES_EXECUTIVOS) {
  const gId = await insertGroup(itemId, 'Escolha as carnes', null, true, 1, 1, 1);
  if (itemId === ITEMS.COWBOY) {
    await insertOption(gId, 'Com fraldinha', 'Fraldinha suculenta assada na brasa e filetada na hora', 0, 1);
    await insertOption(gId, 'Com maminha', 'Maminha macia assada na brasa e filetada na hora', 0, 2);
    await insertOption(gId, 'Com cupim', 'Delicioso cupim cozido por mais de 6 horas e posteriormente assado na brasa', 0, 3);
  } else if (itemId === ITEMS.TROPEIRO) {
    await insertOption(gId, 'Com cupim', 'Delicioso cupim cozido por mais de 6 horas e posteriormente assado na brasa', 0, 1);
    await insertOption(gId, 'Com costela no bafo', 'Costela cozida lentamente no bafo, desfiando na boca', 0, 2);
  }
}

// Cowboy - Guarnição 1
{
  const gId = await insertGroup(ITEMS.COWBOY, 'Guarnição 1', 'Escolha sua guarnição principal', true, 1, 1, 2);
  await insertOption(gId, 'Com mandioca frita', null, 0, 1);
  await insertOption(gId, 'Com batata frita', null, 0, 2);
}

// Cowboy - Guarnição 2
{
  const gId = await insertGroup(ITEMS.COWBOY, 'Guarnição 2', 'Escolha seu acompanhamento', true, 1, 1, 3);
  await insertOption(gId, 'Com maionese de ovos', null, 0, 1);
  await insertOption(gId, 'Com farofa à moda', null, 0, 2);
}

// Fit - Escolha a proteína
{
  const gId = await insertGroup(ITEMS.FIT, 'Escolha a proteína', null, true, 1, 1, 1);
  await insertOption(gId, 'Com frango', null, 0, 1);
  await insertOption(gId, 'Com alcatra', null, 0, 2);
  await insertOption(gId, 'Com lombo suíno', null, 0, 3);
}

// Fit - Guarnição 1
{
  const gId = await insertGroup(ITEMS.FIT, 'Guarnição 1', null, true, 1, 1, 2);
  await insertOption(gId, 'Com mandioca cozida', null, 0, 1);
  await insertOption(gId, 'Com arroz biro biro', null, 0, 2);
}

// Fit - Guarnição 2
{
  const gId = await insertGroup(ITEMS.FIT, 'Guarnição 2', null, true, 1, 1, 3);
  await insertOption(gId, 'Com farofa à moda', null, 0, 1);
  await insertOption(gId, 'Com chips caseira', null, 0, 2);
}

// Laçador - Guarnição
{
  const gId = await insertGroup(ITEMS.LACADOR, 'Guarnição', null, true, 1, 1, 1);
  await insertOption(gId, 'Com fritas clássicas', null, 0, 1);
  await insertOption(gId, 'Com batata chips', null, 0, 2);
}

// Tropeiro - Guarnição já inclusa (feijão tropeiro + arroz biro biro + maionese de ovos)
// Tropeiro - Ponto da carne
{
  const gId = await insertGroup(ITEMS.TROPEIRO, 'Escolha o ponto da carne', null, false, 0, 1, 2);
  await insertOption(gId, 'Bem passado', null, 0, 1);
  await insertOption(gId, 'Mal passado', null, 0, 2);
}

// Pescador - não tem escolha de carne (salmão fixo)
// Pescador - Ponto do salmão
{
  const gId = await insertGroup(ITEMS.PESCADOR, 'Ponto do salmão', null, false, 0, 1, 1);
  await insertOption(gId, 'Ao ponto', null, 0, 1);
  await insertOption(gId, 'Bem passado', null, 0, 2);
}

// Peãozinho - Proteína principal
{
  const gId = await insertGroup(ITEMS.PEAOZINHO, 'Proteína principal', null, true, 1, 1, 1);
  await insertOption(gId, 'Mac and cheese (macarrão)', null, 0, 1);
  await insertOption(gId, 'Nhoque ao pomodoro', null, 0, 2);
}

// Peãozinho - Proteína secundária
{
  const gId = await insertGroup(ITEMS.PEAOZINHO, 'Proteína secundária', null, true, 1, 1, 2);
  await insertOption(gId, 'Nuggets caseiros de frango', null, 0, 1);
  await insertOption(gId, 'Fraldinha fatiada', null, 0, 2);
}

// Peãozinho - Guarnição 1
{
  const gId = await insertGroup(ITEMS.PEAOZINHO, 'Guarnição 1', null, true, 1, 1, 3);
  await insertOption(gId, 'Com batata sorriso', null, 0, 1);
  await insertOption(gId, 'Com batata chips', null, 0, 2);
}

// Estrelinha - Proteína
{
  const gId = await insertGroup(ITEMS.ESTRELINHA, 'Proteína', null, true, 1, 1, 1);
  await insertOption(gId, 'Estrogonofe de carne', null, 0, 1);
  await insertOption(gId, 'Iscas de frango', null, 0, 2);
}

// Estrelinha - Guarnição 1
{
  const gId = await insertGroup(ITEMS.ESTRELINHA, 'Guarnição 1', null, true, 1, 1, 2);
  await insertOption(gId, 'Com polenta frita', null, 0, 1);
  await insertOption(gId, 'Com mandioca frita', null, 0, 2);
}

// Estrelinha - Guarnição 2
{
  const gId = await insertGroup(ITEMS.ESTRELINHA, 'Guarnição 2', null, true, 1, 1, 3);
  await insertOption(gId, 'Com arroz branco', null, 0, 1);
  await insertOption(gId, 'Com purê de mandioca', null, 0, 2);
}

// ============================================================
// COMPLEMENTOS COMUNS (Molho, Ponto, Talheres, Turbine)
// Aplicados a: Executivos, Marmitex, Kits, Mixes
// ============================================================

const ITENS_COM_PONTO_MOLHO_TURBINE_TALHER = [
  ITEMS.COWBOY, ITEMS.FIT, ITEMS.LACADOR, ITEMS.TROPEIRO,
  ITEMS.MARMITEX_P, ITEMS.MARMITEX_M, ITEMS.MARMITEX_G,
  ITEMS.MARMITEX_ECO,
  ITEMS.KIT_NOBRE, ITEMS.KIT_TRAD, ITEMS.MIX_NOBRE, ITEMS.MIX_TRAD
];

// Pescador não tem ponto da carne (já tem), mas tem molho, turbine e talher
const ITENS_COM_MOLHO_TURBINE_TALHER = [ITEMS.PESCADOR];

// Infantis têm apenas talher
const ITENS_SOM_TALHER = [ITEMS.PEAOZINHO, ITEMS.ESTRELINHA];

for (const itemId of ITENS_COM_PONTO_MOLHO_TURBINE_TALHER) {
  // Ponto da carne (exceto Cowboy e Tropeiro que já têm)
  if (![ITEMS.COWBOY, ITEMS.TROPEIRO].includes(itemId)) {
    const gId = await insertGroup(itemId, 'Escolha o ponto da carne', null, false, 0, 1, 4);
    await insertOption(gId, 'Bem passado', null, 0, 1);
    await insertOption(gId, 'Mal passado', null, 0, 2);
  }

  // Molho para o churrasco
  const gMolho = await insertGroup(itemId, 'Molho para o churrasco?', 'Escolha até 3 opções de molho', false, 0, 3, 5);
  await insertOption(gMolho, 'Molho chimichurri', 'Molho chimichurri individual', 399, 1);
  await insertOption(gMolho, 'Molho barbecue', 'Molho barbecue individual', 349, 2);
  await insertOption(gMolho, 'Limão para espremer', 'Limão fatiado para espremer e comer com churrasco!', 199, 3);
  await insertOption(gMolho, 'Alho frito', 'Alho frito individual', 349, 4);

  // Turbine seu pedido
  const gTurbine = await insertGroup(itemId, '"Turbine" seu pedido!', 'Adicione mais itens ao seu pedido', false, 0, 10, 6);
  await insertOption(gTurbine, 'Mandioca extra', 'Porção extra de mandioca frita', 599, 1);
  await insertOption(gTurbine, 'Bananas empanadas (2un)', 'Clássicas bananas empanadas fritas na hora', 1490, 2);
  await insertOption(gTurbine, 'Maionese de ovos extra', 'Porção extra de maionese de ovos caseira', 399, 3);
  await insertOption(gTurbine, 'Farofa à moda extra', 'Porção extra da farofa especial do Estrela', 399, 4);
  await insertOption(gTurbine, 'Vinagrete extra', 'Porção extra de vinagrete fresco', 299, 5);
  await insertOption(gTurbine, 'Batata frita extra', 'Porção extra de batata frita', 599, 6);
  await insertOption(gTurbine, 'Queijinho bola assado', 'Queijo assado na churrasqueira a carvão', 699, 7);
  await insertOption(gTurbine, 'Anéis de cebola empanados', 'Porção de anéis de cebola empanados', 1790, 8);
  await insertOption(gTurbine, 'Nuggets de frango', 'Porção de nuggets de frango crocantes', 1690, 9);
  await insertOption(gTurbine, 'Porção de mini pastéis', 'Mini pastéis fritos na hora (catupiry ou romeu e julieta)', 2490, 10);

  // Precisa de talheres?
  const gTalher = await insertGroup(itemId, 'Precisa de talheres?', null, true, 1, 3, 7);
  await insertOption(gTalher, 'Com talher', null, 50, 1);
  await insertOption(gTalher, 'Sem talher', null, 0, 2);
}

for (const itemId of ITENS_COM_MOLHO_TURBINE_TALHER) {
  const gMolho = await insertGroup(itemId, 'Molho para o peixe?', 'Escolha até 2 opções de molho', false, 0, 2, 2);
  await insertOption(gMolho, 'Limão para espremer', 'Limão fatiado para espremer', 199, 1);
  await insertOption(gMolho, 'Molho chimichurri', 'Molho chimichurri individual', 399, 2);
  await insertOption(gMolho, 'Molho barbecue', 'Molho barbecue individual', 349, 3);

  const gTurbine = await insertGroup(itemId, '"Turbine" seu pedido!', null, false, 0, 5, 3);
  await insertOption(gTurbine, 'Batata frita extra', null, 599, 1);
  await insertOption(gTurbine, 'Legumes extras', null, 399, 2);
  await insertOption(gTurbine, 'Arroz extra', null, 399, 3);

  const gTalher = await insertGroup(itemId, 'Precisa de talheres?', null, true, 1, 3, 4);
  await insertOption(gTalher, 'Com talher', null, 50, 1);
  await insertOption(gTalher, 'Sem talher', null, 0, 2);
}

for (const itemId of ITENS_SOM_TALHER) {
  const gTalher = await insertGroup(itemId, 'Precisa de talheres?', null, true, 1, 3, 4);
  await insertOption(gTalher, 'Com talher', null, 50, 1);
  await insertOption(gTalher, 'Sem talher', null, 0, 2);
}

// ============================================================
// KITS E MIXES - Preferências de carnes
// ============================================================

// Kit Nobre - Preferências (escolha de 4 a 5 carnes)
{
  const gId = await insertGroup(ITEMS.KIT_NOBRE, 'Preferências', 'Escolha de 4 a 5 opções de carne', true, 4, 5, 1);
  await insertOption(gId, 'Picanha', null, 0, 1);
  await insertOption(gId, 'Filé mignon', null, 0, 2);
  await insertOption(gId, 'T-bone cordeiro', null, 0, 3);
  await insertOption(gId, 'Ancho', null, 0, 4);
  await insertOption(gId, 'Linguiça cuiabana recheada', null, 0, 5);
  await insertOption(gId, 'Baby beef', null, 0, 6);
  await insertOption(gId, 'Javali', null, 0, 7);
}

// Kit Tradicional - Preferências
{
  const gId = await insertGroup(ITEMS.KIT_TRAD, 'Preferências', 'Escolha de 4 a 5 opções de carne', true, 4, 5, 1);
  await insertOption(gId, 'Costelão bovino', null, 0, 1);
  await insertOption(gId, 'Cupim', null, 0, 2);
  await insertOption(gId, 'Maminha c/ queijo', null, 0, 3);
  await insertOption(gId, 'Fraldinha', null, 0, 4);
  await insertOption(gId, 'Linguiça cuiabana recheada', null, 0, 5);
  await insertOption(gId, 'Coração', null, 0, 6);
  await insertOption(gId, 'Frango', null, 0, 7);
}

// Mix Nobre - Preferências (escolha de até 5 carnes)
{
  const gId = await insertGroup(ITEMS.MIX_NOBRE, 'Preferências', 'Escolha até 5 opções de carne', true, 1, 5, 1);
  await insertOption(gId, 'Picanha', null, 0, 1);
  await insertOption(gId, 'Filé mignon', null, 0, 2);
  await insertOption(gId, 'T-bone cordeiro', null, 0, 3);
  await insertOption(gId, 'Ancho', null, 0, 4);
  await insertOption(gId, 'Linguiça cuiabana recheada', null, 0, 5);
  await insertOption(gId, 'Baby beef', null, 0, 6);
  await insertOption(gId, 'Javali', null, 0, 7);
}

// Mix Tradicional - Preferências
{
  const gId = await insertGroup(ITEMS.MIX_TRAD, 'Preferências', 'Escolha até 5 opções de carne', true, 1, 5, 1);
  await insertOption(gId, 'Costelão bovino', null, 0, 1);
  await insertOption(gId, 'Cupim', null, 0, 2);
  await insertOption(gId, 'Maminha c/ queijo', null, 0, 3);
  await insertOption(gId, 'Fraldinha', null, 0, 4);
  await insertOption(gId, 'Linguiça cuiabana recheada', null, 0, 5);
  await insertOption(gId, 'Coração', null, 0, 6);
  await insertOption(gId, 'Frango', null, 0, 7);
}

// ============================================================
// MARMITEX - Troca de acompanhamento
// ============================================================
for (const itemId of [ITEMS.MARMITEX_P, ITEMS.MARMITEX_M, ITEMS.MARMITEX_G]) {
  const gId = await insertGroup(itemId, 'Trocar', 'Deseja trocar algum acompanhamento?', false, 0, 1, 3);
  await insertOption(gId, 'Trocar batata frita por mandioca frita', null, 0, 1);
  await insertOption(gId, 'Trocar farofa por vinagrete', null, 0, 2);
  await insertOption(gId, 'Trocar maionese por vinagrete', null, 0, 3);
}

// Marmitex Econômica - Trocar
{
  const gId = await insertGroup(ITEMS.MARMITEX_ECO, 'Trocar', 'Deseja trocar algum acompanhamento?', false, 0, 1, 3);
  await insertOption(gId, 'Trocar maionese por vinagrete', null, 0, 1);
  await insertOption(gId, 'Trocar maionese por sobremesa surpresa', null, 0, 2);
}

// ============================================================
// GUARNIÇÕES - Complementos específicos
// ============================================================

// Mini pastéis - sabor
{
  const gId = await insertGroup(ITEMS.MINI_PASTEIS, 'Escolha o sabor', null, true, 1, 1, 1);
  await insertOption(gId, 'Catupiry (salgado)', null, 0, 1);
  await insertOption(gId, 'Romeu e julieta (queijo c/ goiabada)', null, 0, 2);
}

// Mini pastéis - quantidade
{
  const gId = await insertGroup(ITEMS.MINI_PASTEIS, 'Quantidade', null, true, 1, 1, 2);
  await insertOption(gId, '4 unidades', null, 0, 1);
  await insertOption(gId, '10 unidades', null, 600, 2);
}

// Arroz - tipo
{
  const gId = await insertGroup(ITEMS.ARROZ, 'Tipo de arroz', null, true, 1, 1, 1);
  await insertOption(gId, 'Arroz branco', null, 0, 1);
  await insertOption(gId, 'Arroz biro biro com toque da Estrela do Sul', null, 0, 2);
}

// Água mineral - tipo
{
  const gId = await insertGroup(ITEMS.AGUA, 'Tipo', null, true, 1, 1, 1);
  await insertOption(gId, 'Sem gás', null, 0, 1);
  await insertOption(gId, 'Com gás', null, 0, 2);
}

// Refrigerantes 2L - sabor
{
  const gId = await insertGroup(ITEMS.REFRI_2L, 'Escolha o sabor', null, true, 1, 1, 1);
  await insertOption(gId, 'Coca-Cola', null, 0, 1);
  await insertOption(gId, 'Coca-Cola Zero', null, 0, 2);
  await insertOption(gId, 'Guaraná Antarctica', null, 0, 3);
  await insertOption(gId, 'Fanta Laranja', null, 0, 4);
  await insertOption(gId, 'Fanta Uva', null, 0, 5);
  await insertOption(gId, 'Sprite', null, 0, 6);
}

// Refrigerantes Econômicos - sabor
{
  const gId = await insertGroup(ITEMS.REFRI_ECO, 'Escolha o sabor', null, true, 1, 1, 1);
  await insertOption(gId, 'Guaraná Antarctica', null, 0, 1);
  await insertOption(gId, 'Fanta Laranja', null, 0, 2);
  await insertOption(gId, 'Fanta Uva', null, 0, 3);
}

// Refrigerantes lata - sabor
{
  const gId = await insertGroup(ITEMS.REFRI_LATA, 'Escolha o sabor', null, true, 1, 1, 1);
  await insertOption(gId, 'Coca-Cola 350ml', null, 0, 1);
  await insertOption(gId, 'Coca-Cola Zero 350ml', null, 0, 2);
  await insertOption(gId, 'Guaraná Antarctica lata', null, 0, 3);
  await insertOption(gId, 'Sprite lata', null, 0, 4);
}

// Sucos Del Valle - sabor
{
  const gId = await insertGroup(ITEMS.SUCO_DELVALLE, 'Escolha o sabor', null, true, 1, 1, 1);
  await insertOption(gId, 'Uva', null, 0, 1);
  await insertOption(gId, 'Pêssego', null, 0, 2);
  await insertOption(gId, 'Manga', null, 0, 3);
  await insertOption(gId, 'Maracujá', null, 0, 4);
  await insertOption(gId, 'Goiaba', null, 0, 5);
}

// Cervejas Long Neck - marca
{
  const gId = await insertGroup(ITEMS.CERVEJA_LONGNECK, 'Escolha a cerveja', null, true, 1, 1, 1);
  await insertOption(gId, 'Heineken', null, 0, 1);
  await insertOption(gId, 'Budweiser', null, 0, 2);
  await insertOption(gId, 'Corona', null, 0, 3);
  await insertOption(gId, 'Stella Artois', null, 0, 4);
  await insertOption(gId, 'Amstel', null, 0, 5);
}

// Cervejas lata - marca
{
  const gId = await insertGroup(ITEMS.CERVEJA_LATA, 'Escolha a cerveja', null, true, 1, 1, 1);
  await insertOption(gId, 'Brahma', null, 0, 1);
  await insertOption(gId, 'Skol', null, 0, 2);
  await insertOption(gId, 'Antartica', null, 0, 3);
  await insertOption(gId, 'Itaipava', null, 0, 4);
}

// Saladas - molho
for (const itemId of [ITEMS.SALADA_CAPRESE, ITEMS.SALADA_SIMPLES, ITEMS.SALADA_CAESAR, ITEMS.SALADA_ESTRELA]) {
  const gId = await insertGroup(itemId, 'Molho à sua escolha', null, true, 1, 1, 1);
  await insertOption(gId, 'Azeite e limão', null, 0, 1);
  await insertOption(gId, 'Vinagrete clássico', null, 0, 2);
  await insertOption(gId, 'Molho Caesar', null, 0, 3);
  await insertOption(gId, 'Molho de mostarda e mel', null, 0, 4);
}

await conn.end();
console.log('✅ Todos os complementos cadastrados com sucesso!');
