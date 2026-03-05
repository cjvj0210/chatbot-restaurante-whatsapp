import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function run() {
  console.log('🔄 Iniciando atualização completa do cardápio...');

  // ============================================================
  // 1. CORRIGIR PREÇOS DOS ITENS
  // ============================================================
  console.log('\n📦 Corrigindo preços...');
  
  const priceUpdates = [
    // Batatas chips: era 1690, deve ser 990
    [990, 150016],
    // Batatas fritas: era 1890, deve ser 990
    [990, 150017],
    // Banana Empanada: era 1490, deve ser 1299 (2 unidades R$12,99)
    [1299, 150011],
    // Refrigerantes Econômicos: era 1400, deve ser 1450
    [1450, 150029],
    // Suco de abacaxi: era 1400, deve ser 1400 (correto)
    // Cervejas Long Neck: era 1500, deve ser 1500 (correto)
  ];
  
  for (const [price, id] of priceUpdates) {
    await conn.execute('UPDATE menu_items SET price = ? WHERE id = ?', [price, id]);
    console.log(`  ✅ Item ${id} → R$ ${(price/100).toFixed(2)}`);
  }

  // ============================================================
  // 2. CORRIGIR DESCRIÇÕES DOS ITENS
  // ============================================================
  console.log('\n📝 Corrigindo descrições...');
  
  const descUpdates = [
    [150001, 'Cowboy individual', 'Fraldinha, maminha ou cupim — suculentos cortes feitos na brasa e filetados na hora. Acompanha arroz biro biro, mandioca frita ou batata frita, e maionese de ovos ou farofa à moda.'],
    [150002, 'Executivo Fit Premium', 'Frango, alcatra ou lombo suíno — proteínas grelhadas com acompanhamentos leves. Inclui guarnição à escolha (mandioca cozida, arroz branco ou biro biro) e farofa à moda ou chips caseira. Salada simples inclusa.'],
    [150003, 'Laçador individual', 'Delicioso e suculento churrasco filetado ao molho de Catupiry Original. Acompanha arroz branco, feijão e fritas clássicas ou batata chips.'],
    [150004, 'Tropeiro individual', 'Costela no bafo ou cupim da casa — suculentos cortes feitos na brasa e filetados na hora. Acompanha arroz biro biro, feijão tropeiro e maionese de ovos.'],
    [150005, 'Pescador individual', 'Salmão premium grelhado ao molho agridoce de maracujá. Acompanha arroz branco, batata chips e legumes salteados na manteiga.'],
    [150006, 'Peãozinho - infantil', 'Prato infantil com mac and cheese ou nhoque ao pomodoro, nuggets caseiros ou fraldinha fatiada, batata sorriso ou chips, e legumes salteados ou salada do dia.'],
    [150007, 'Estrelinha - infantil', 'Prato infantil com estrogonofe de carne ou iscas de frango, polenta frita ou batata frita, arroz branco ou purê de mandioca, e salada do dia ou legumes salteados.'],
    [150008, 'Marmitex Completa P', 'Arroz, feijão, fritas, farofa, vinagrete e churrasco com frango, linguiça e um misto de carnes bovinas e/ou suínas filetadas ao estilo e tempero inconfundível da Estrela do Sul!'],
    [150009, 'Marmitex Completa M', 'Arroz, feijão, fritas, farofa, vinagrete e churrasco com frango, linguiça e um misto de carnes bovinas e/ou suínas filetadas ao estilo e tempero inconfundível da Estrela do Sul!'],
    [150010, 'Tradicional Marmitex G', 'Arroz, feijão, fritas, farofa, vinagrete e churrasco com frango, linguiça e um misto de carnes bovinas e/ou suínas filetadas ao estilo e tempero inconfundível da Estrela do Sul!'],
    [150011, 'Banana Empanada (2 unidades)', 'Deliciosas bananas empanadas e fritas, acompanhamento clássico do churrasco gaúcho.'],
    [150012, 'Porções de mini pastéis', 'Deliciosos mini-pastéis fritos na hora — de Catupiry, romeu e julieta (queijo c/ goiabada) ou mistos. Disponível em 4 ou 10 unidades.'],
    [150013, 'Queijinho bola Assado (unidade)', 'Queijo unitário assado na churrasqueira a carvão, estilo churrasco! Zero açúcar.'],
    [150014, 'Anéis de cebola empanados', 'Inconfundível anel de cebola empanado e frito na hora, presente há anos no rodízio do Estrela, agora para você comer no conforto de casa!'],
    [150015, 'Nuggets de frango', 'Deliciosos nuggets de frango — crocante e macio ao mesmo tempo. Disponível em tamanho individual ou grande.'],
    [150016, 'Batatas chips', 'Batatinha chips caseira, presente há tempos no rodízio Estrela do Sul. Crocante, saborosa e caseira! Disponível em individual ou grande.'],
    [150017, 'Batatas fritas', 'A guarnição mais consumida do brasileiro. Deliciosa porção de batatinhas fritas na hora. Disponível em individual ou grande.'],
    [150018, 'Arroz', 'Embalagem de marmitex cheia de arroz à sua escolha: arroz branco, arroz + feijão, ou arroz biro biro.'],
    [150019, 'Marmitex econômica 1 (individual)', 'Saborosa opção que se encaixa no seu bolso! Arroz branco, feijão, farofa à moda, maionese de ovos, 2 frangos e 1 linguiça — com sabor de churrasco Estrela do Sul.'],
    [150020, 'Kit de churrasco nobre', '1,100kg de churrasco com carnes nobres filetadas ao estilo Estrela do Sul! Picanha, filé mignon, t-bone de cordeiro, ancho, linguiça cuiabana recheada, baby beef e javali. Acompanha 3 bananas empanadas, mandioca cozida, farofa à moda, vinagrete e molhos. Serve até 3 pessoas.'],
    [150021, 'Kit de churrasco tradicional', '1,100kg de churrasco com carnes filetadas ao estilo Estrela do Sul! Costelão bovino, cupim, maminha c/ queijo, fraldinha, linguiça cuiabana recheada, coração e frango. Acompanha 3 bananas empanadas, mandioca cozida, farofa à moda, vinagrete e molhos. Serve até 3 pessoas.'],
    [150022, 'Mix de churrasco nobre', 'Personalize seu mix com até 5 opções de carnes nobres (mais de 600g)! Carnes suculentas, bem temperadas e filetadas ao estilo do rodízio Estrela do Sul. Acompanha farofa à moda e vinagrete individuais. Serve até 2 pessoas.'],
    [150023, 'Mix de churrasco tradicional', 'Personalize seu mix com até 5 opções de churrasco (mais de 600g)! Carnes suculentas, bem temperadas e filetadas ao estilo do rodízio Estrela do Sul. Acompanha farofa à moda e vinagrete individuais.'],
    [150024, 'Salada Caprese', 'Clássica salada Caprese preparada com o toque da Estrela do Sul. Mix de folhas com tomate e mussarela.'],
    [150025, 'Salada Simples', 'Salada simples, porém muito bem preparada! Com rúcula, alface, tomate, cenoura ralada e vinagrete.'],
    [150026, 'Salada Caesar', 'Clássica salada Caesar com molho especial da casa.'],
    [150027, 'Salada Estrela', 'Salada criada através da composição do buffet Estrela do Sul. Porção de rúcula fresca, tomate seco e palmito de açaí.'],
  ];
  
  for (const [id, name, desc] of descUpdates) {
    await conn.execute('UPDATE menu_items SET name = ?, description = ? WHERE id = ?', [name, desc, id]);
  }
  console.log(`  ✅ ${descUpdates.length} descrições atualizadas`);

  // ============================================================
  // 3. CORRIGIR GRUPOS DE COMPLEMENTOS INCORRETOS
  // ============================================================
  console.log('\n🔧 Corrigindo grupos de complementos...');

  // 3a. Cowboy individual (150001): Escolha as carnes deve ter 3 opções (fraldinha, cupim, maminha)
  // Verificar e corrigir grupo 1 (Escolha as carnes do Cowboy)
  const [cowboyCarnes] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150001 AND name = "Escolha as carnes"');
  if (cowboyCarnes.length > 0) {
    const gId = cowboyCarnes[0].id;
    // Atualizar para escolha de 1 a 2 (como no iFood)
    await conn.execute('UPDATE menu_addon_groups SET minSelections = 1, maxSelections = 2 WHERE id = ?', [gId]);
    // Verificar opções existentes
    const [opts] = await conn.execute('SELECT id, name FROM menu_addon_options WHERE groupId = ?', [gId]);
    const optNames = opts.map(o => o.name);
    if (!optNames.includes('Com maminha')) {
      const maxOrder = opts.length;
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, ?)', 
        [gId, 'Com maminha', 'Suculenta maminha feita na brasa e filetada na hora', maxOrder]);
      console.log('  ✅ Adicionada opção "Com maminha" ao Cowboy individual');
    }
  }

  // 3b. Executivo Fit Premium (150002): Corrigir grupo "Escolha a proteína" → "Escolha as carnes" com opções corretas
  const [fitGrupo] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150002 AND name LIKE "%proteína%"');
  if (fitGrupo.length > 0) {
    const gId = fitGrupo[0].id;
    await conn.execute('UPDATE menu_addon_groups SET name = "Escolha as carnes" WHERE id = ?', [gId]);
    // Verificar opções
    const [opts] = await conn.execute('SELECT id, name FROM menu_addon_options WHERE groupId = ?', [gId]);
    const optNames = opts.map(o => o.name);
    const needed = [
      ['Com frango e alcatra', 'Frango e alcatra grelhados'],
      ['Com lombo e alcatra', 'Lombo suíno e alcatra grelhados'],
      ['Só lombo suíno', 'Apenas lombo suíno grelhado'],
      ['Só frango', 'Apenas frango grelhado'],
    ];
    // Limpar opções antigas e inserir corretas
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    for (let i = 0; i < needed.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, ?)', 
        [gId, needed[i][0], needed[i][1], i]);
    }
    console.log('  ✅ Corrigidas opções de carnes do Executivo Fit Premium');
  }

  // 3c. Executivo Fit Premium (150002): Guarnição 1 deve ter 3 opções
  const [fitGuar1] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150002 AND name = "Guarnição 1"');
  if (fitGuar1.length > 0) {
    const gId = fitGuar1[0].id;
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Com mandioca cozida', 'Mandioca cozida', 0],
      ['Com Arroz Branco', 'Arroz branco', 0],
      ['Com arroz biro biro', 'Arroz biro biro com toque da Estrela do Sul', 0],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], opts[i][2], i]);
    }
    console.log('  ✅ Corrigida Guarnição 1 do Executivo Fit Premium');
  }

  // 3d. Laçador individual (150003): Guarnição deve ter 3 opções
  const [lacGuar] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150003 AND name = "Guarnição"');
  if (lacGuar.length > 0) {
    const gId = lacGuar[0].id;
    await conn.execute('UPDATE menu_addon_groups SET name = "Guarnição 1" WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Com Batata Frita', 'Batata frita individual', 0],
      ['Com mandioca frita', 'Mandioca frita individual', 0],
      ['Com batata chips', 'Batata chips caseira individual', 0],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], opts[i][2], i]);
    }
    console.log('  ✅ Corrigida Guarnição do Laçador individual');
  }

  // 3e. Laçador individual (150003): Adicionar grupo "Escolha a carne"
  const [lacCarne] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150003 AND name LIKE "%carne%" AND name NOT LIKE "%ponto%"');
  if (lacCarne.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 0)',
      [150003, 'Escolha a carne']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Com contra filé', 'Delicioso contra filé grelhado ao molho de Catupiry Original']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 1190, 1)', 
      [gId, 'Com filé mignon', 'Nobre filé mignon grelhado ao molho de Catupiry Original (+R$ 11,90)']);
    console.log('  ✅ Adicionado grupo "Escolha a carne" ao Laçador individual');
  }

  // 3f. Tropeiro individual (150004): Escolha as carnes deve ter 2 opções corretas
  const [tropCarne] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150004 AND name = "Escolha as carnes"');
  if (tropCarne.length > 0) {
    const gId = tropCarne[0].id;
    const [opts] = await conn.execute('SELECT id, name FROM menu_addon_options WHERE groupId = ?', [gId]);
    const optNames = opts.map(o => o.name);
    if (!optNames.some(n => n.includes('costela'))) {
      await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
        [gId, 'Com cupim', 'Delicioso cupim cozido por mais de 6 horas e posteriormente assado na brasa']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
        [gId, 'Com costela no bafo', 'Deliciosa e suculenta costela feita no bafo, à maneira do churrasco gaúcho']);
      console.log('  ✅ Corrigidas opções de carnes do Tropeiro individual');
    }
  }

  // 3g. Peãozinho (150006): Corrigir grupos para o padrão do iFood
  // Renomear "Proteína principal" → "Preferência" e "Proteína secundária" → "Guarnição 1"
  await conn.execute('UPDATE menu_addon_groups SET name = "Preferência" WHERE menuItemId = 150006 AND name = "Proteína principal"');
  await conn.execute('UPDATE menu_addon_groups SET name = "Guarnição 1" WHERE menuItemId = 150006 AND name = "Proteína secundária"');
  
  // Adicionar Guarnição 2 (salada do dia ou legumes salteados) ao Peãozinho se não existir
  const [peaoGuar2] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150006 AND name = "Guarnição 2"');
  if (peaoGuar2.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 2)',
      [150006, 'Guarnição 2']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 0)', [gId, 'Com salada do dia']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 1)', [gId, 'Com legumes salteados']);
    console.log('  ✅ Adicionada Guarnição 2 ao Peãozinho');
  }

  // Corrigir Guarnição 1 do Peãozinho (batata sorriso ou batata chips → deve ser guarnição 3)
  // Renomear para Guarnição 3
  const [peaoGuar1] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150006 AND name = "Guarnição 1"');
  if (peaoGuar1.length > 0) {
    const gId = peaoGuar1[0].id;
    await conn.execute('UPDATE menu_addon_groups SET name = "Guarnição 3", displayOrder = 3 WHERE id = ?', [gId]);
    console.log('  ✅ Renomeada Guarnição 1 → Guarnição 3 no Peãozinho');
  }

  // 3h. Estrelinha (150007): Corrigir grupos
  await conn.execute('UPDATE menu_addon_groups SET name = "Preferência" WHERE menuItemId = 150007 AND name = "Proteína"');
  
  // Adicionar Guarnição 2 (salada do dia ou legumes salteados) à Estrelinha se não existir
  const [estrelaGuar2] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150007 AND name = "Guarnição 2"');
  if (estrelaGuar2.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 2)',
      [150007, 'Guarnição 2']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 0)', [gId, 'Com salada do dia']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 1)', [gId, 'Com legumes salteados']);
    console.log('  ✅ Adicionada Guarnição 2 à Estrelinha');
  }

  // Renomear Guarnição 1 da Estrelinha para Guarnição 3 (arroz branco ou purê)
  const [estrelaGuar1] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150007 AND name = "Guarnição 1"');
  if (estrelaGuar1.length > 0) {
    const gId = estrelaGuar1[0].id;
    await conn.execute('UPDATE menu_addon_groups SET name = "Guarnição 3", displayOrder = 3 WHERE id = ?', [gId]);
    console.log('  ✅ Renomeada Guarnição 1 → Guarnição 3 na Estrelinha');
  }

  // ============================================================
  // 4. CORRIGIR GRUPOS DAS MARMITEX (P, M, G)
  // ============================================================
  console.log('\n🍱 Corrigindo complementos das Marmitex...');

  for (const itemId of [150008, 150009, 150010]) {
    // Verificar se já tem "Alterar Variedade De Carnes"
    const [existing] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = ? AND name LIKE "%Alterar%"', [itemId]);
    if (existing.length === 0) {
      const [res] = await conn.execute(
        'INSERT INTO menu_addon_groups (menuItemId, name, description, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, ?, 1, 1, 1, 0)',
        [itemId, 'Alterar Variedade De Carnes', 'Personalize as proteínas da sua marmitex']
      );
      const gId = res.insertId;
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
        [gId, 'Não desejo alterar o mix de carnes', 'As proteínas serão: Frango, Linguiça e Mix de Churrasco (carnes bovinas e/ou suínas)']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 249, 1)', 
        [gId, 'Retirar Frango e Linguiça', 'Substituiremos o Frango e Linguiça com mais Mix de Churrasco (carnes bovinas e/ou suínas)']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 349, 2)', 
        [gId, 'Desejo Apenas Carnes Bovinas', 'A mistura da marmitex consiste em apenas churrasco de carnes bovinas']);
      console.log(`  ✅ Adicionado grupo "Alterar Variedade De Carnes" ao item ${itemId}`);
    }

    // Verificar se já tem "Escolha o ponto da carne"
    const [existingPonto] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = ? AND name LIKE "%ponto%"', [itemId]);
    if (existingPonto.length === 0) {
      const [res] = await conn.execute(
        'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 0, 0, 1, 1)',
        [itemId, 'Escolha o ponto da carne']
      );
      const gId = res.insertId;
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 0)', [gId, 'Ao ponto da casa']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 1)', [gId, 'Bem passado']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 2)', [gId, 'Mal passado']);
      console.log(`  ✅ Adicionado grupo "Escolha o ponto da carne" ao item ${itemId}`);
    }

    // Verificar se já tem "Substitua a sua maneira"
    const [existingSubst] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = ? AND name LIKE "%Substitua%"', [itemId]);
    if (existingSubst.length === 0) {
      const [res] = await conn.execute(
        'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 0, 0, 2, 2)',
        [itemId, 'Substitua a sua maneira']
      );
      const gId = res.insertId;
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
        [gId, 'Trocar: batata frita por mandioca frita', 'Substitui a batatinha frita do seu marmitex por mandioca frita']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
        [gId, 'Trocar: (arroz + feijão) por mandioca cozida', 'Substitui o arroz e feijão da marmitex por mandioca cozida']);
      console.log(`  ✅ Adicionado grupo "Substitua a sua maneira" ao item ${itemId}`);
    }

    // Verificar e corrigir turbine das marmitex
    const [turbineGroup] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = ? AND name LIKE "%Turbine%"', [itemId]);
    if (turbineGroup.length > 0) {
      const gId = turbineGroup[0].id;
      await conn.execute('UPDATE menu_addon_groups SET maxSelections = 5 WHERE id = ?', [gId]);
      // Verificar opções existentes
      const [opts] = await conn.execute('SELECT name FROM menu_addon_options WHERE groupId = ?', [gId]);
      const optNames = opts.map(o => o.name);
      
      // Adicionar opções faltantes
      const turbineOpts = [
        ['Mandioca cozida extra (individual)', 'Porção individual de mandioca cozida', 999],
        ['Mandioca frita extra (individual)', 'Porção individual de mandioca frita', 1399],
        ['Banana empanada (2 unidades)', 'Duas bananas empanadas e fritas', 1699],
        ['Mini-pastéis de Catupiry (4 unidades)', '4 mini-pastéis de Catupiry', 1899],
        ['Mini-pastéis de queijo c/ goiabada (4 unidades)', '4 mini-pastéis de romeu e julieta', 1999],
        ['Porção extra de fritas (individual)', 'Porção individual de batata frita', 1199],
        ['Porção de chips (individual)', 'Porção individual de batata chips', 899],
        ['Maionese de ovos extra (individual)', 'Porção individual de maionese de ovos', 799],
        ['Com queijinho assado (1 unidade)', 'Queijinho bola assado na churrasqueira', 699],
        ['Alho frito extra (individual)', 'Porção individual de alho frito', 399],
        ['Molho chimichurri extra (individual)', 'Molho chimichurri individual', 399],
        ['Limão para espremer', 'Limão fatiado para espremer e comer com churrasco!', 399],
        ['Molho barbecue extra (individual)', 'Molho barbecue individual', 499],
        ['Farofa extra (individual)', 'Porção individual de farofa à moda', 399],
        ['Pudim de leite condensado (individual)', 'Delicioso pudim de leite condensado', 999],
        ['Vinagrete extra (individual)', 'Porção individual de vinagrete', 399],
        ['Pavê de brigadeiro (individual)', 'Delicioso pavê de brigadeiro', 999],
        ['Mousse de maracujá (individual)', 'Mousse de maracujá individual', 999],
      ];
      
      let added = 0;
      let order = opts.length;
      for (const [name, desc, price] of turbineOpts) {
        if (!optNames.some(n => n.toLowerCase().includes(name.toLowerCase().substring(0, 15)))) {
          await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
            [gId, name, desc, price, order++]);
          added++;
        }
      }
      if (added > 0) console.log(`  ✅ Adicionadas ${added} opções ao turbine da marmitex ${itemId}`);
    }
  }

  // ============================================================
  // 5. CORRIGIR MARMITEX ECONÔMICA (150019)
  // ============================================================
  console.log('\n💰 Corrigindo Marmitex Econômica...');

  const [econGroups] = await conn.execute('SELECT id, name FROM menu_addon_groups WHERE menuItemId = 150019');
  const econGroupNames = econGroups.map(g => g.name);

  if (!econGroupNames.some(n => n.includes('Trocar'))) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 0, 0, 1, 0)',
      [150019, 'Trocar']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Trocar Maionese de ovos por vinagrete', 'Substitui a maionese de ovos da casa por vinagrete — vai separado das outras comidas']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
      [gId, 'Trocar Maionese por sobremesa surpresa', 'Sobremesa varia a cada dia']);
    console.log('  ✅ Adicionado grupo "Trocar" à Marmitex Econômica');
  }

  if (!econGroupNames.some(n => n.includes('Turbine') || n.includes('turbine'))) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 0, 0, 1, 1)',
      [150019, '"Turbine" seu pedido']
    );
    const gId = res.insertId;
    const turbineOpts = [
      ['Batatinha frita na marmitex individual', 'Porção individual de batata frita dentro da marmitex', 299],
      ['Mandioca frita na marmitex individual', 'Porção individual de mandioca frita dentro da marmitex', 299],
      ['Banana empanada 2 unidades', 'Duas bananas empanadas e fritas', 1299],
      ['Banana empanada 4 unidades', 'Quatro bananas empanadas e fritas', 2199],
      ['Maionese de ovos extra individual', 'Porção individual de maionese de ovos', 349],
      ['Farofa à moda extra individual', 'Porção individual de farofa à moda', 349],
    ];
    for (let i = 0; i < turbineOpts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, turbineOpts[i][0], turbineOpts[i][1], turbineOpts[i][2], i]);
    }
    console.log('  ✅ Adicionado grupo "Turbine" à Marmitex Econômica');
  }

  if (!econGroupNames.some(n => n.includes('talher'))) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 2)',
      [150019, 'Precisa de talher?']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 75, 0)', [gId, 'Com talher individual']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 1)', [gId, 'Sem talher']);
    console.log('  ✅ Adicionado grupo "Precisa de talher?" à Marmitex Econômica');
  }

  // ============================================================
  // 6. CORRIGIR GRUPOS DAS GUARNIÇÕES
  // ============================================================
  console.log('\n🍟 Corrigindo complementos das guarnições...');

  // Arroz (150018): Corrigir opções
  const [arrozGrupo] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150018');
  if (arrozGrupo.length > 0) {
    const gId = arrozGrupo[0].id;
    await conn.execute('UPDATE menu_addon_groups SET name = "Escolha o seu arroz", isRequired = 1 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Arroz branco', 'Embalagem cheia de arroz branco', 0],
      ['Arroz + feijão juntos em 1 embalagem', 'Arroz e feijão juntos em uma embalagem', 299],
      ['Arroz biro biro', 'Embalagem cheia de arroz biro biro', 699],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], opts[i][2], i]);
    }
    console.log('  ✅ Corrigidas opções do Arroz');
  }

  // Batatas fritas (150017): Adicionar tamanho
  const [fritasGrupo] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150017');
  if (fritasGrupo.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 0)',
      [150017, 'Escolha o tamanho']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Individual', 'Porção para 1 pessoa']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 1090, 1)', 
      [gId, 'Grande (para compartilhar)', 'Porção grande para compartilhar']);
    console.log('  ✅ Adicionado grupo "Escolha o tamanho" às Batatas fritas');
  }

  // Batatas chips (150016): Adicionar tamanho
  const [chipsGrupo] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150016');
  if (chipsGrupo.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 0)',
      [150016, 'Escolha o tamanho']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Individual', 'Porção para 1 pessoa']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 1490, 1)', 
      [gId, 'Grande', 'Porção grande para compartilhar']);
    console.log('  ✅ Adicionado grupo "Escolha o tamanho" às Batatas chips');
  }

  // Nuggets (150015): Adicionar tamanho
  const [nuggetsGrupo] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150015');
  if (nuggetsGrupo.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 0)',
      [150015, 'Escolha o tamanho']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Individual', 'Porção para 1 pessoa']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 1490, 1)', 
      [gId, 'Grande (para compartilhar)', 'Porção grande para compartilhar']);
    console.log('  ✅ Adicionado grupo "Escolha o tamanho" aos Nuggets');
  }

  // Anéis de cebola (150014): Adicionar tamanho
  const [aneisGrupo] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150014');
  if (aneisGrupo.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 0)',
      [150014, 'Escolha o tamanho']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Individual', 'Porção para 1 pessoa']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 1390, 1)', 
      [gId, 'Grande (para compartilhar)', 'Porção grande para compartilhar']);
    console.log('  ✅ Adicionado grupo "Escolha o tamanho" aos Anéis de cebola');
  }

  // Mini pastéis (150012): Corrigir grupos
  const [pasteisGrupos] = await conn.execute('SELECT id, name FROM menu_addon_groups WHERE menuItemId = 150012');
  const pasteisGroupNames = pasteisGrupos.map(g => g.name);
  
  if (!pasteisGroupNames.some(n => n.includes('tamanho'))) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 0)',
      [150012, 'Escolha o tamanho']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 0)', [gId, '4 unidades de pastéis']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 1000, 1)', [gId, '10 unidades de pastéis']);
    console.log('  ✅ Adicionado grupo "Escolha o tamanho" aos Mini pastéis');
  }

  if (!pasteisGroupNames.some(n => n.includes('sabor'))) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 1, 1)',
      [150012, 'Escolha os sabores']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Só Catupiry', 'Porção apenas com mini-pastéis de Catupiry c/ orégano']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
      [gId, 'Só romeu e julieta', 'Porção apenas com mini-pastéis de queijo com goiabada']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 2)', 
      [gId, 'Mista (Catupiry e romeu/julieta)', 'Porção de mini-pastéis mista com os 2 sabores']);
    console.log('  ✅ Adicionado grupo "Escolha os sabores" aos Mini pastéis');
  }

  // ============================================================
  // 7. CORRIGIR SALADAS - Molhos corretos
  // ============================================================
  console.log('\n🥗 Corrigindo complementos das saladas...');

  for (const itemId of [150024, 150025, 150026, 150027]) {
    // Atualizar grupo de molhos para permitir 2 opções
    await conn.execute(
      'UPDATE menu_addon_groups SET name = "Peça seu molho favorito!", minSelections = 1, maxSelections = 2 WHERE menuItemId = ? AND name LIKE "%Molho%"',
      [itemId]
    );
    
    // Verificar opções de molho existentes
    const [molhoGroup] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = ? AND name LIKE "%molho%"', [itemId]);
    if (molhoGroup.length > 0) {
      const gId = molhoGroup[0].id;
      const [opts] = await conn.execute('SELECT name FROM menu_addon_options WHERE groupId = ?', [gId]);
      const optNames = opts.map(o => o.name);
      
      // Salada Estrela (150027) tem molho Caesar também
      if (itemId === 150027 && !optNames.some(n => n.includes('Caesar'))) {
        await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
          [gId, 'Molho Caesar', 'Clássico molho Caesar (Marca Junior)']);
      }
      
      // Verificar se tem Italian e French
      if (!optNames.some(n => n.includes('Italian'))) {
        await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
          [gId, 'Molho Italian', 'Molho Italian (Marca Junior)']);
      }
      if (!optNames.some(n => n.includes('French'))) {
        await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 2)', 
          [gId, 'Molho French', 'Molho French (Marca Junior)']);
      }
    }

    // Verificar se tem grupo de talheres
    const [talherGroup] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = ? AND name LIKE "%talher%"', [itemId]);
    if (talherGroup.length === 0) {
      const [res] = await conn.execute(
        'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 1, 1, 2, 1)',
        [itemId, 'Precisa de talheres?']
      );
      const gId = res.insertId;
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 50, 0)', [gId, 'Com talher']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, 1)', [gId, 'Sem talher']);
      console.log(`  ✅ Adicionado grupo "Precisa de talheres?" à salada ${itemId}`);
    }
  }

  // ============================================================
  // 8. CORRIGIR BEBIDAS - Refrigerantes lata (adicionar sabores faltantes)
  // ============================================================
  console.log('\n🥤 Corrigindo complementos das bebidas...');

  const [refriGroup] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150033');
  if (refriGroup.length > 0) {
    const gId = refriGroup[0].id;
    const [opts] = await conn.execute('SELECT name FROM menu_addon_options WHERE groupId = ?', [gId]);
    const optNames = opts.map(o => o.name);
    const needed = [
      ['Coca-Cola', 0],
      ['Guaraná Antartica', 0],
      ['Guaraná Antartica zero', 0],
      ['Sprite', 0],
      ['Soda limonada', 0],
      ['Fanta laranja', 0],
      ['Fanta uva', 0],
    ];
    let added = 0;
    let order = opts.length;
    for (const [name, price] of needed) {
      if (!optNames.some(n => n.toLowerCase().includes(name.toLowerCase()))) {
        await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, ?, ?)', 
          [gId, name, price, order++]);
        added++;
      }
    }
    if (added > 0) console.log(`  ✅ Adicionados ${added} sabores aos Refrigerantes lata`);
  }

  // Refrigerantes 2L (150028): Corrigir sabores
  const [refri2lGroup] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150028');
  if (refri2lGroup.length > 0) {
    const gId = refri2lGroup[0].id;
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Guaraná Antartica 2l', 0],
      ['Coca-Cola 2l', 199],
      ['Coca-Cola zero 2l', 199],
      ['Fanta laranja 2l', 0],
      ['Soda 2l', 0],
      ['Pepsi 2l', 0],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], i]);
    }
    console.log('  ✅ Corrigidos sabores dos Refrigerantes 2L');
  }

  // Cervejas Long Neck (150036): Verificar e corrigir opções
  const [lnGroup] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150036');
  if (lnGroup.length > 0) {
    const gId = lnGroup[0].id;
    const [opts] = await conn.execute('SELECT name FROM menu_addon_options WHERE groupId = ?', [gId]);
    const optNames = opts.map(o => o.name);
    const needed = [
      'Heineken',
      'Budweiser',
      'Corona',
      'Stella Artois',
      'Amstel',
    ];
    let added = 0;
    let order = opts.length;
    for (const name of needed) {
      if (!optNames.some(n => n.toLowerCase().includes(name.toLowerCase()))) {
        await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, ?)', 
          [gId, name, order++]);
        added++;
      }
    }
    if (added > 0) console.log(`  ✅ Adicionadas ${added} marcas às Cervejas Long Neck`);
  }

  // ============================================================
  // 9. CORRIGIR MIX DE CHURRASCO - Preferências
  // ============================================================
  console.log('\n🥩 Corrigindo preferências dos churrascos...');

  // Mix de churrasco tradicional (150023): Corrigir preferências
  const [mixTradPref] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150023 AND name = "Preferências"');
  if (mixTradPref.length > 0) {
    const gId = mixTradPref[0].id;
    await conn.execute('UPDATE menu_addon_groups SET minSelections = 4, maxSelections = 5 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      'Com fraldinha',
      'Com cupim',
      'Com frango assado',
      'Com lombo suíno',
      'Com maminha',
      'Com linguiça toscana',
      'Com linguiça cuiabana',
      'Com queijinho assado',
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, ?)', 
        [gId, opts[i], i]);
    }
    console.log('  ✅ Corrigidas preferências do Mix de churrasco tradicional');
  }

  // Mix de churrasco nobre (150022): Corrigir preferências
  const [mixNobrePref] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150022 AND name = "Preferências"');
  if (mixNobrePref.length > 0) {
    const gId = mixNobrePref[0].id;
    await conn.execute('UPDATE menu_addon_groups SET minSelections = 4, maxSelections = 5 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      'Com picanha',
      'Com filé mignon',
      'Com t-bone de cordeiro',
      'Com maminha com queijo',
      'Com javali',
      'Com costela bovina',
      'Com linguiça cuiabana recheada',
      'Com queijinho assado',
      'Com ancho argentino',
      'Com alcatra',
      'Com paleta de cordeiro',
      'Com pão de alho assado',
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, priceExtra, displayOrder) VALUES (?, ?, 0, ?)', 
        [gId, opts[i], i]);
    }
    console.log('  ✅ Corrigidas preferências do Mix de churrasco nobre');
  }

  // Kit de churrasco tradicional (150021): Corrigir preferências
  const [kitTradPref] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150021 AND name = "Preferências"');
  if (kitTradPref.length > 0) {
    const gId = kitTradPref[0].id;
    await conn.execute('UPDATE menu_addon_groups SET minSelections = 0, maxSelections = 5, isRequired = 0 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Sem frango', 'Retira o frango da variedade de 1kg de carnes'],
      ['Sem coração', 'Retira o coração da variedade de 1kg de carnes'],
      ['Com queijinho bola', 'Adiciona queijinho bola para completar a variedade em 1kg do churrasco'],
      ['Sem linguiça cuiabana', 'Retira a linguiça da variedade de 1kg de carnes'],
      ['Com carne suína', 'Adiciona carne suína à variedade das carnes'],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, ?)', 
        [gId, opts[i][0], opts[i][1], i]);
    }
    console.log('  ✅ Corrigidas preferências do Kit de churrasco tradicional');
  }

  // Adicionar "Quer adaptar seu kit?" ao Kit tradicional
  const [kitTradAdapt] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150021 AND name LIKE "%adaptar%"');
  if (kitTradAdapt.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 0, 0, 1, 2)',
      [150021, 'Quer adaptar seu kit? :)']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Trocar: vinagrete por maionese de ovos', 'Trocamos na montagem do seu kit o acompanhamento de vinagrete pela maionese de ovos da casa']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
      [gId, 'Trocar: mandioca cozida por arroz branco', 'Troca na montagem do seu kit a mandioca cozida pelo arroz branco característico da Estrela do Sul!']);
    console.log('  ✅ Adicionado grupo "Quer adaptar seu kit?" ao Kit tradicional');
  }

  // Kit de churrasco nobre (150020): Corrigir preferências
  const [kitNobrePref] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150020 AND name = "Preferências"');
  if (kitNobrePref.length > 0) {
    const gId = kitNobrePref[0].id;
    await conn.execute('UPDATE menu_addon_groups SET minSelections = 0, maxSelections = 5, isRequired = 0 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Sem javali', 'Retira o javali da variedade de 1,1kg de carnes'],
      ['Com queijinho bola', 'Adiciona queijinho bola para completar a variedade em 1,1kg do churrasco'],
      ['Sem linguiça cuiabana', 'Retira a linguiça da variedade de 1,1kg de carnes'],
      ['Com costela bovina', 'Adiciona costela bovina ao mix de 1,1kg de carnes'],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, ?)', 
        [gId, opts[i][0], opts[i][1], i]);
    }
    console.log('  ✅ Corrigidas preferências do Kit de churrasco nobre');
  }

  // Adicionar "Quer adaptar seu kit?" ao Kit nobre
  const [kitNobreAdapt] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150020 AND name LIKE "%adaptar%"');
  if (kitNobreAdapt.length === 0) {
    const [res] = await conn.execute(
      'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 0, 0, 1, 2)',
      [150020, 'Quer adaptar seu kit? :)']
    );
    const gId = res.insertId;
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
      [gId, 'Trocar: vinagrete por maionese de ovos', 'Trocamos na montagem do seu kit o acompanhamento de vinagrete pela maionese de ovos da casa']);
    await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
      [gId, 'Trocar: mandioca cozida por arroz branco', 'Troca na montagem do seu kit a mandioca cozida pelo arroz branco característico da Estrela do Sul!']);
    console.log('  ✅ Adicionado grupo "Quer adaptar seu kit?" ao Kit nobre');
  }

  // ============================================================
  // 10. CORRIGIR TURBINE DOS CHURRASCOS
  // ============================================================
  console.log('\n🚀 Corrigindo turbine dos churrascos...');

  // Kit tradicional turbine (150021)
  const [kitTradTurbine] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150021 AND name LIKE "%Turbine%"');
  if (kitTradTurbine.length > 0) {
    const gId = kitTradTurbine[0].id;
    await conn.execute('UPDATE menu_addon_groups SET maxSelections = 12 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Kit para 5 pessoas', 'Adiciona mais de todos os componentes do kit, transformando em um kit que serve facilmente 5 pessoas!', 6490],
      ['Queijinho assado extra 1 unidade', 'Queijinho bola assado na churrasqueira', 699],
      ['Bananas empanadas extra 2 unidades', 'Duas bananas empanadas e fritas extras', 1699],
      ['Porção de chips extra individual', 'Porção individual de batata chips', 999],
      ['Porção de fritas extra individual', 'Porção individual de batata frita', 1199],
      ['Mandioca cozida extra individual', 'Porção individual de mandioca cozida', 999],
      ['Mandioca frita extra individual', 'Porção individual de mandioca frita', 1399],
      ['Maionese de ovos extra individual', 'Porção individual de maionese de ovos', 899],
      ['Molho chimichurri extra individual', 'Molho chimichurri individual', 499],
      ['Alho frito extra individual', 'Porção individual de alho frito', 499],
      ['Molho barbecue extra individual', 'Molho barbecue individual', 549],
      ['Limão para espremer', 'Limão fatiado para espremer e comer com churrasco!', 399],
      ['Farofa extra individual', 'Porção individual de farofa à moda', 499],
      ['Vinagrete extra individual', 'Porção individual de vinagrete', 399],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], opts[i][2], i]);
    }
    console.log('  ✅ Corrigido turbine do Kit tradicional');
  }

  // Kit nobre turbine (150020)
  const [kitNobreTurbine] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150020 AND name LIKE "%Turbine%"');
  if (kitNobreTurbine.length > 0) {
    const gId = kitNobreTurbine[0].id;
    await conn.execute('UPDATE menu_addon_groups SET maxSelections = 12 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Kit para 5 pessoas', 'Adiciona mais de todos os componentes do kit, transformando em um kit que serve facilmente 5 pessoas!', 7490],
      ['Queijinho assado extra 1 unidade', 'Queijinho bola assado na churrasqueira', 699],
      ['Bananas empanadas extra 2 unidades', 'Duas bananas empanadas e fritas extras', 1499],
      ['Porção de chips individual', 'Porção individual de batata chips', 999],
      ['Porção de fritas individual', 'Porção individual de batata frita', 1199],
      ['Mandioca cozida individual', 'Porção individual de mandioca cozida', 1199],
      ['Mandioca frita individual', 'Porção individual de mandioca frita', 1399],
      ['Maionese de ovos individual', 'Porção individual de maionese de ovos', 899],
      ['Molho chimichurri extra individual', 'Molho chimichurri individual', 399],
      ['Alho frito extra individual', 'Porção individual de alho frito', 399],
      ['Molho barbecue extra individual', 'Molho barbecue individual', 499],
      ['Limão para espremer', 'Limão fatiado para espremer e comer com churrasco!', 349],
      ['Farofa extra individual', 'Porção individual de farofa à moda', 399],
      ['Vinagrete extra individual', 'Porção individual de vinagrete', 399],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], opts[i][2], i]);
    }
    console.log('  ✅ Corrigido turbine do Kit nobre');
  }

  // Mix nobre turbine (150022)
  const [mixNobreTurbine] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150022 AND name LIKE "%Turbine%"');
  if (mixNobreTurbine.length > 0) {
    const gId = mixNobreTurbine[0].id;
    await conn.execute('UPDATE menu_addon_groups SET maxSelections = 10 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Mandioca cozida extra individual', 'Porção individual de mandioca cozida', 649],
      ['Bananas empanadas 2 unidades', 'Duas bananas empanadas e fritas', 1299],
      ['Maionese de ovos extra individual', 'Porção individual de maionese de ovos', 599],
      ['Farofa extra individual', 'Porção individual de farofa à moda', 349],
      ['Vinagrete extra individual', 'Porção individual de vinagrete', 349],
      ['Pudim de leite individual', 'Delicioso pudim de leite condensado', 699],
      ['Pavê de brigadeiro individual', 'Delicioso pavê de brigadeiro', 999],
      ['Mousse de maracujá individual', 'Mousse de maracujá individual', 999],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], opts[i][2], i]);
    }
    console.log('  ✅ Corrigido turbine do Mix nobre');
  }

  // Mix tradicional turbine (150023)
  const [mixTradTurbine] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = 150023 AND name LIKE "%Turbine%"');
  if (mixTradTurbine.length > 0) {
    const gId = mixTradTurbine[0].id;
    await conn.execute('UPDATE menu_addon_groups SET maxSelections = 10 WHERE id = ?', [gId]);
    await conn.execute('DELETE FROM menu_addon_options WHERE groupId = ?', [gId]);
    const opts = [
      ['Mandioca cozida extra individual', 'Porção individual de mandioca cozida', 549],
      ['Bananas empanadas 2 unidades', 'Duas bananas empanadas e fritas', 949],
      ['Maionese de ovos extra individual', 'Porção individual de maionese de ovos', 399],
      ['Farofa extra individual', 'Porção individual de farofa à moda', 349],
      ['Vinagrete extra individual', 'Porção individual de vinagrete', 349],
    ];
    for (let i = 0; i < opts.length; i++) {
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, ?, ?)', 
        [gId, opts[i][0], opts[i][1], opts[i][2], i]);
    }
    console.log('  ✅ Corrigido turbine do Mix tradicional');
  }

  // ============================================================
  // 11. ADICIONAR "Quer adaptar?" ao Mix de churrascos
  // ============================================================
  for (const itemId of [150022, 150023]) {
    const [adapt] = await conn.execute('SELECT id FROM menu_addon_groups WHERE menuItemId = ? AND name LIKE "%adaptar%"', [itemId]);
    if (adapt.length === 0) {
      const [res] = await conn.execute(
        'INSERT INTO menu_addon_groups (menuItemId, name, isRequired, minSelections, maxSelections, displayOrder) VALUES (?, ?, 0, 0, 1, 3)',
        [itemId, 'Quer adaptar seu pedido? :)']
      );
      const gId = res.insertId;
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 0)', 
        [gId, 'Trocar: vinagrete por maionese de ovos', 'Trocamos o vinagrete pela maionese de ovos da casa']);
      await conn.execute('INSERT INTO menu_addon_options (groupId, name, description, priceExtra, displayOrder) VALUES (?, ?, ?, 0, 1)', 
        [gId, 'Trocar: mandioca cozida por arroz branco', 'Troca a mandioca cozida pelo arroz branco']);
      console.log(`  ✅ Adicionado "Quer adaptar?" ao item ${itemId}`);
    }
  }

  console.log('\n✅ Atualização completa do cardápio concluída!');
  await conn.end();
}

run().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
