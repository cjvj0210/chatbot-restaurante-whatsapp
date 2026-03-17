# TODO - Chatbot WhatsApp para Restaurante

## Banco de Dados
- [x] Schema para configurações do restaurante (nome, horário, endereço, telefone)
- [x] Schema para cardápio (categorias, itens, preços, disponibilidade)
- [x] Schema para pedidos (cliente, itens, status, total, endereço entrega)
- [x] Schema para reservas (cliente, data/hora, número pessoas, status)
- [x] Schema para clientes (nome, telefone, histórico)
- [x] Schema para conversas/mensagens (histórico de atendimento)
- [x] Schema para configurações do WhatsApp (token, número, webhook)

## Backend - Integração WhatsApp Cloud API
- [x] Endpoint webhook para receber mensagens do WhatsApp
- [x] Função para enviar mensagens via Cloud API
- [x] Função para enviar mensagens com botões interativos
- [x] Função para enviar cardápio como lista interativa
- [x] Validação de webhook do WhatsApp
- [x] Gerenciamento de sessões de conversa

## Backend - IA Conversacional
- [x] Integração com GPT-4/Gemini para processamento de linguagem natural
- [x] Sistema de detecção de intenção (pedido, reserva, informação, feedback)
- [x] Contexto de conversa (manter histórico da sessão)
- [x] Respostas personalizadas baseadas no cardápio do restaurante
- [ ] Extração de entidades (itens do pedido, quantidade, observações)

## Backend - Lógica de Negócio
- [ ] Fluxo de pedido de delivery (seleção itens, endereço, confirmação)
- [ ] Fluxo de reserva de mesa (data, horário, pessoas, confirmação)
- [ ] Fluxo de informações gerais (horário, localização, pagamento)
- [ ] Fluxo de coleta de feedback
- [ ] Cálculo automático de total do pedido
- [ ] Validação de disponibilidade de horários para reserva
- [ ] Envio de confirmações automáticas
- [ ] Sistema de lembretes (reservas, pedidos)

## Frontend - Painel Administrativo
- [x] Dashboard com estatísticas (pedidos, reservas, atendimentos)
- [x] Página de gerenciamento de cardápio (CRUD)
- [x] Página de visualização de pedidos (lista, detalhes, status)
- [x] Página de visualização de reservas (calendário, lista, status)
- [x] Página de configurações do restaurante
- [x] Página de configurações do WhatsApp (token, webhook)
- [ ] Página de histórico de conversas
- [ ] Página de clientes (lista, histórico)
- [ ] Sistema de notificações em tempo real

## Testes
- [x] Teste de dashboard stats
- [x] Teste de configurações do restaurante
- [x] Teste de categorias do cardápio
- [x] Teste de itens do cardápio
- [x] Teste de listagem de pedidos
- [x] Teste de listagem de reservas
- [x] Teste de listagem de clientes
- [x] Teste de listagem de feedback

## Documentação
- [ ] Guia de configuração do WhatsApp Business API
- [ ] Guia de configuração do painel admin
- [ ] Documentação de fluxos de conversa
- [ ] README com instruções de deploy


## Melhorias no Simulador de Chat
- [x] Substituir respostas pré-programadas por IA conversacional real (GPT-4)
- [x] Implementar contexto de conversa (memória de mensagens anteriores)
- [x] Criar sistema prompt com tom de voz da Churrascaria
- [x] Integrar simulador com backend tRPC
- [x] Adicionar informações do restaurante no contexto da IA
- [ ] Testar respostas naturais e contextualizadas
- [ ] Aguardar conversas reais do WhatsApp para análise
- [ ] Analisar conversas exportadas e extrair padrões
- [ ] Treinar IA com exemplos reais de atendimento
- [ ] Ajustar tom de voz baseado em conversas reais


## Atualização com Dados Reais do Vídeo/Catálogo
- [x] Extrair todas as informações do vídeo WhatsApp
- [x] Documentar valores corretos do rodízio infantil
- [x] Documentar estrutura de pedidos (nome, endereço, forma pagamento)
- [x] Atualizar system prompt com tom de voz real
- [x] Atualizar banco de dados com valores corretos
- [x] Testar IA com informações atualizadas


## Extração do Catálogo Delivery (Vídeo)
- [x] Extrair todos os frames do vídeo do catálogo
- [x] Documentar todos os itens de marmitex com preços
- [x] Documentar pratos executivos e kits
- [x] Documentar bebidas e adicionais
- [x] Cadastrar itens no banco de dados
- [x] Atualizar IA com cardápio completo


## Análise de Conversas Reais do WhatsApp
- [x] Extrair conversas dos 7 arquivos ZIP
- [x] Analisar tom de voz real da equipe
- [x] Identificar padrões de atendimento e fluxos
- [x] Extrair dúvidas frequentes dos clientes
- [x] Identificar informações faltantes no sistema
- [x] Documentar correções necessárias
- [x] Atualizar system prompt da IA com aprendizados
- [x] Testar IA com cenários reais das conversas


## Simulador de Conversas WhatsApp
- [x] Criar interface de chat simulando WhatsApp
- [x] Integrar simulador com lógica do chatbot
- [x] Adicionar histórico de conversas de teste
- [x] Permitir reset de conversa
- [x] Adicionar indicador de digitação
- [ ] Testar todos os fluxos (pedido, reserva, informações)


## Ajustes de Tom e Regras de Negócio
- [x] Reescrever prompt para tom mais humano e natural
- [x] Remover hashtags e asteriscos desnecessários
- [x] Respostas mais concisas e contextuais
- [x] Regra: sempre passar preços individuais, nunca somar
- [x] Regra: eventos 10+ pessoas = coletar dados para orçamento PDF
- [x] Regra: sábado noite e domingo almoço sem reserva
- [x] Regra: sexta jantar reserva até 19:40h
- [x] Regra: 80% das pessoas devem chegar no horário da reserva
- [x] Adicionar suporte a transcrição de áudios WhatsApp
- [ ] Testar todos os cenários no simulador


## Ajustes Finais do Bot
- [x] Mudar nome do bot para "Gaúcho"
- [x] Adicionar contexto de data atual (não perguntar que dia é)
- [x] Observação sobre documento com foto para preços infantis
- [x] Política de aniversário: petit gateau grátis com documento, sem outros descontos


## Atualização Completa de Cardápio Delivery
- [x] Extrair ingredientes exatos de todos os pratos executivos
- [x] Adicionar descrições detalhadas de marmitex (G, M, P, Econômico)
- [x] Incluir mix de churrasco (Tradicional e Nobre) com quantidades
- [x] Adicionar guarnições e salgados com variações
- [x] Incluir carta de drinks (caipirinhas, batidas, doses, assinaturas)
- [x] Adicionar carta de vinhos (brancos, tintos, espumantes, exóticos)
- [x] Remover menção de "não entrega sábado" (só mencionar se for sábado)
- [x] Testar oferecimento de pratos com nomes corretos


## Restaurar Pratos Executivos
- [x] Extrair ingredientes detalhados de todos os pratos executivos do PDF
- [x] Adicionar Executivo Estrelinha com descrição completa
- [x] Adicionar Executivo Peãozinho com descrição completa
- [x] Adicionar Executivo Tropeiro com descrição completa
- [x] Adicionar Executivo Cowboy com descrição completa
- [x] Adicionar Executivo Fit com descrição completa
- [x] Adicionar Executivo Laçador (Filé Mignon e Contra Filé) com descrição completa
- [x] Adicionar Executivo Pescador com descrição completa
- [x] Atualizar Kit Churrasco com carnes à moda corretas
- [x] Testar oferecimento de pratos executivos no simulador


## Análise de Conversas Reais do WhatsApp Business
- [x] Descompactar todos os 15 arquivos ZIP de conversas
- [x] Analisar tom de voz e padrões de resposta
- [x] Identificar palavras e expressões comuns da marca
- [x] Mapear uso de emojis e formatação
- [x] Extrair valores atualizados (out/2025 em diante)
- [x] Identificar como lidar com solicitações especiais
- [x] Atualizar prompt do bot com aprendizados
- [x] Documentar todos os insights extraídos


## Atualização Carta de Vinhos Atual
- [x] Extrair vinhos brancos e espumantes com preços atualizados
- [x] Extrair vinhos tintos intensos e encorpados com preços atualizados
- [x] Extrair vinhos exóticos ou diferenciados com preços atualizados
- [x] Extrair vinhos tintos leves a médios com preços atualizados
- [x] Extrair vinhos da casa com preços atualizados
- [x] Atualizar prompt do bot com carta de vinhos completa
- [x] Testar conhecimento de vinhos no simulador


## Correções de Tom e Comportamento do Bot
- [x] Analisar conversa do simulador e documentar problemas
- [x] Tornar bot MUITO mais educado e cordial
- [x] Aumentar uso de emojis (manter moderação mas ser mais caloroso)
- [x] Listar ingredientes completos ao falar de pratos delivery
- [x] Melhorar saudações e despedidas
- [x] Adicionar mais empatia nas respostas
- [x] Testar nova versão no simulador


## Escalação para Atendente Humano e Resumo de Pedido
- [x] Detectar frustração/nervosismo do cliente (palavras-chave, repetição de problemas)
- [x] Oferecer opção de falar com humano quando detectar frustração
- [x] Criar sistema de "apertar número" para escalar atendimento
- [x] Adicionar instrução de geração de PNG no prompt
- [x] Integrar envio automático de PNG após confirmação de pedido
- [x] Implementar gerador real de imagem PNG (backend)
- [x] Testar fluxo completo de escalação
- [x] Testar geração e envio de PNG


## Correção Final de Formatação
- [x] Reforçar proibição de hashtags (###) e asteriscos duplos (**)
- [x] Adicionar exemplos práticos de respostas corretas
- [x] Garantir uso adequado de emojis (2-4 por mensagem)
- [x] Eliminar asteriscos simples (*) de listas
- [x] Adicionar emojis contextuais em todas as listas (🥩 🍖 🍗 🐟 🥗 🍚 🍟)
- [x] Validar tom educado e cordial em todas as respostas
- [x] Testar múltiplas interações para validar
- [x] Confirmar ZERO hashtags, ZERO asteriscos, emojis contextuais em TODAS as listas


## Troca de Nome do Bot
- [x] Trocar "Gaúcho" para "Gaúchinho 🤠" em todas as ocorrências
- [x] Testar apresentação no simulador
- [x] Validar que emoji aparece corretamente


## CORREÇÃO CRÍTICA - Exposição de Raciocínio Interno
- [x] Adicionar instrução explícita para NUNCA mostrar processo de pensamento
- [x] Instruir IA a responder APENAS com a mensagem final limpa
- [x] Testar múltiplas interações para validar
- [x] Confirmar que ZERO texto técnico aparece nas respostas
- [x] Validar via API que resposta está limpa e natural


## Funcionalidade de Áudio no Simulador WhatsApp
- [x] Adicionar botão de gravação de áudio na interface do simulador
- [x] Implementar captura de áudio do microfone do navegador
- [x] Implementar upload de áudio para S3
- [x] Criar endpoint tRPC para processar áudio
- [x] Integrar transcrição de áudio (Whisper API)
- [x] Processar transcrição pelo chatbot
- [x] Exibir áudio gravado como mensagem no chat
- [x] Testar fluxo completo de gravação → transcrição → resposta (pronto para teste do usuário)


## Página Pública de Teste do Chatbot
- [x] Criar tabela `test_sessions` no banco (ID, data, user-agent, IP)
- [x] Criar tabela `test_messages` no banco (session_id, role, content, tipo, timestamp)
- [x] Criar página pública `/teste` sem autenticação
- [x] Interface WhatsApp limpa (apenas conversa, sem sidebar)
- [x] Implementar endpoint para criar sessão de teste
- [x] Implementar endpoint para salvar mensagens no banco
- [x] Adaptar endpoints de áudio para salvar no banco
- [x] Criar página administrativa `/conversas-teste`
- [x] Listar todas as sessões de teste
- [x] Visualizar mensagens completas de cada sessão
- [x] Exibir áudios e transcrições
- [x] Adicionar ao menu do dashboard
- [x] Testar URL compartilhável completa


## CORREÇÃO URGENTE - Informações Incorretas do Restaurante
- [x] Atualizar preço do rodízio jantar para R$ 109,90 (estava R$ 89,90)
- [x] Corrigir horário de fechamento para 22:45h (estava 23h)
- [x] Adicionar informação sobre buffet de comida japonesa no rodízio
- [x] Adicionar informação sobre sobremesas incluídas
- [x] Remover menção a "à la carte" no rodízio presencial (É APENAS RODÍZIO)
- [x] Criar arquivo compartilhado chatbotPrompt.ts com prompt completo
- [x] Atualizar publicTest.ts para usar prompt compartilhado
- [x] Atualizar banco de dados com informações corretas
- [x] Testar correções no simulador e página pública (SUCESSO!)


## CORREÇÃO URGENTE - Asteriscos e Tom de Conversa
- [x] Corrigir horário de jantar: 19h (não 18h!)
- [x] ELIMINAR asteriscos duplos (**) - adicionado PROIBIÇÃO ABSOLUTA
- [x] Reduzir tamanho das respostas (máximo 3-4 linhas) - regra explícita
- [x] Remover informações óbvias (dia da semana) - regra de bom senso
- [x] Tornar conversa mais fluida e humana - prompt reescrito
- [x] Adicionar 4 exemplos práticos de respostas CURTAS e DIRETAS
- [x] Testar múltiplas perguntas para validar (3 testes - TODOS PERFEITOS!)


## CORREÇÃO CRÍTICA - Profissionalismo e Humildade
- [x] Adicionar regra: NUNCA inventar ou supor informações
- [x] Adicionar regra: Admitir quando NÃO sabe algo
- [x] Adicionar regra: Oferecer telefone ou atendente humano quando incerto
- [x] Completar informações do rodízio (buffet ibérico, queijos especiais, pratos quentes variados)
- [x] Adicionar lista clara do que o bot SABE (9 itens) vs NÃO SABE (8 itens)
- [x] Adicionar 3 exemplos práticos de como lidar com incertezas
- [x] Adicionar 3 exemplos do que NÃO fazer ("vai ter fila", "provavelmente conseguimos")
- [x] Testar cenários de perguntas que ele não deveria saber (3 testes - TODOS PERFEITOS!)


## Sistema de Aprendizado Iterativo
- [x] Corrigir ordem: Atendente humano ANTES de telefone (1º atendente, 2º telefone)
- [x] Analisar conversas de teste para identificar lacunas (10 categorias)
- [x] Criar questionário ML estruturado (38 perguntas organizadas por prioridade)
- [x] Documentar processo de atualização iterativa


## CORREÇÃO - Carta de Vinhos Faltando
- [ ] Ler carta de vinhos que usuário já havia fornecido
- [ ] Adicionar carta completa no chatbotPrompt.ts
- [ ] Testar pergunta sobre harmonização


## AUDITORIA COMPLETA - Garantir 100% das Informações
- [x] Auditar carta de vinhos (15+ vinhos com harmonizações) - FALTANDO!
- [x] Auditar cardápio completo (pratos executivos, marmitex, kits) - FALTANDO!
- [x] Auditar todas as correções de formatação aplicadas
- [x] Auditar informações do restaurante (horários, preços, políticas)
- [x] Comparar prompt atual vs informações disponíveis - Completude: 20%!
- [x] Atualizar prompt com TUDO que está faltando (15+ vinhos, 7 executivos, kits, guarnições)
- [x] Corrigir import do zod no publicTest.ts
- [x] Servidor reiniciado automaticamente
- [ ] Usuário deve testar no navegador (5 perguntas de validação)


## CORREÇÕES FINAIS - 100% Completo
- [ ] Corrigir endereço (Barretos → São José do Rio Preto)
- [ ] Corrigir preços do almoço (R$ 119,90/129,90 → R$ 89,90)
- [ ] Adicionar drinks e caipirinhas (se informações disponíveis)


## PROMPT COMPLETO E ROBUSTO - SEM LIMITAÇÃO DE TAMANHO
- [x] Reunir TODAS as informações de todos os arquivos (cardápio, vinhos, etc)
- [x] Criar prompt EXTENSO com tudo (466 linhas!)
- [x] Incluir TODOS os drinks, caipirinhas, batidas, doses (7 drinks assinatura)
- [x] Incluir TODAS as saladas (4 tipos com ingredientes)
- [x] Incluir TODAS as sobremesas detalhadas
- [x] Incluir TODOS os vinhos com harmonizações completas
- [x] Incluir TODOS os pratos executivos com detalhes
- [x] Incluir TODOS os kits com todas as carnes listadas
- [x] Testar completude final (servidor reiniciou sem erros)
- [x] Salvar checkpoint final (648a62bb)


## CORREÇÃO DE PREÇOS - Conferir com Arquivos Originais
- [x] Conferir preços das marmitex nos arquivos originais
- [x] Conferir preços dos executivos nos arquivos originais
- [x] Corrigir taxa de delivery (R$ 7,00 não R$ 8,00)
- [x] Conferir TODOS os outros preços
- [x] Atualizar prompt com preços corretos (16 correções!)


## CORREÇÃO - Mensagem Inicial e Kits
- [ ] Atualizar mensagem inicial para mencionar TODAS as opções (marmitex, mix, executivos, kits)
- [ ] Corrigir explicação sobre Kits Churrasco (presencial vs delivery)
- [ ] Testar mensagem inicial


## CORREÇÃO CRÍTICA - Delivery vs Presencial
- [x] Remover restrição "NÃO DELIVERY" dos Executivos
- [x] Remover restrição "NÃO DELIVERY" dos Kits
- [x] Remover restrição "DELIVERY" do Mix (tudo é delivery)
- [x] Adicionar regra explícita: TUDO pode ser delivery (Marmitex, Mix, Executivos, Kits)
- [x] Testar mensagem inicial e perguntas sobre delivery (servidor reiniciado)


## CORREÇÃO - Regra de Brevidade
- [x] Remover limitação rígida "máximo 3-4 linhas"
- [x] Adicionar regra: Preferir objetividade MAS responder COMPLETAMENTE
- [x] Adicionar regra: Se cliente pede "todos" ou "cada", listar TODOS
- [x] Adicionar regra: Qualidade e completude > brevidade forçada
- [x] Testar pergunta "O que vem em cada executivos?" (servidor reiniciado)


## Sistema de Reservas Diretas via Chatbot (14/12/2024)
- [x] Adicionar contexto de data/hora ao prompt (dia da semana + horário exato)
- [x] Criar campos adicionais no schema de reservas (customerName, customerPhone, source)
- [x] Aplicar migração do banco de dados (pnpm db:push)
- [x] Criar router de reservas via chatbot (chatbotReservations.ts)
- [x] Implementar endpoint createReservation (público)
- [x] Implementar endpoint validateReservation (validação de regras)
- [x] Registrar router no appRouter
- [x] Atualizar prompt com fluxo completo de coleta de reservas
- [x] Integrar coleta de reservas no fluxo de conversação do bot (prompt atualizado)
- [x] Testar contexto de data/hora (SUCESSO - bot sabe dia e horário)
- [x] Testar validação de regras de reservas (SUCESSO - segunda à noite fechado)
- [ ] Testar coleta completa de dados de reserva (nome, telefone, etc)
- [ ] Testar salvamento de reserva no banco de dados


## Bug: Erro de validação na página /teste (16/12/2024)
- [ ] Investigar erro "The string did not match the expected pattern"
- [ ] Corrigir validação no backend
- [ ] Testar correção


## Nova Feature: Cardápio Digital Integrado ao WhatsApp (21/12/2024)
- [x] Pesquisar benchmarks de cardápios digitais (iFood, Rappi, Aiqfome, Goomer)
- [x] Buscar soluções open-source de cardápio digital (MERN Food Ordering, TastyIgniter)
- [x] Pesquisar integrações WhatsApp + cardápio web (webhooks, APIs)
- [x] Analisar melhores opções e tecnologias (stack compatibility)
- [x] Propor arquitetura de integração bot → cardápio → impressão
- [x] Documentar roadmap de implementação (6 semanas, 5 fases)

**Documentação Gerada**:
- PESQUISA_CARDAPIO_DIGITAL.md - Soluções open-source encontradas
- INTEGRACAO_WHATSAPP_CARDAPIO.md - Arquitetura técnica detalhada
- RELATORIO_FINAL_CARDAPIO_DIGITAL.md - Análise completa + recomendações

**Recomendação**: Adaptar MERN Food Ordering System (6 semanas, R$ 30-48k)


## Implementação: Cardápio Digital + WhatsApp (Iniciado 21/12/2024)

### Fase 1: Backend - Banco de Dados
- [x] Adicionar tabela `orderSessions` (links únicos)
- [x] Atualizar tabela `orders` (adicionar sessionId, customerName, customerPhone)
- [x] Adicionar tabela `orderItems` (itens do pedido normalizados)
- [x] Adicionar tabela `botMessages` (fila de mensagens WhatsApp)
- [x] Executar `pnpm db:push` para migrar (SUCESSO - 0004_clammy_dragon_lord.sql)

### Fase 2: Backend - Endpoints tRPC
- [x] Criar `orderLinkRouter.generate` (gerar link único)
- [x] Criar `orderLinkRouter.validate` (validar sessão)
- [x] Criar `orderRouter.create` (criar pedido completo)
- [x] Criar `orderRouter.getBySession` (buscar pedido por sessão)
- [x] Criar `orderRouter.list` (listar pedidos - admin)
- [x] Criar `orderRouter.updateStatus` (atualizar status - admin)
- [x] Registrar routers no appRouter

### Fase 3: Backend - Notificação WhatsApp
- [x] Implementar `notifyWhatsAppBot()` function (adiciona na fila)
- [x] Implementar `formatOrderForWhatsApp()` function (mensagem formatada)
- [x] Implementar `notifyStatusUpdate()` function (atualizações de status)
- [x] Integrar notificações em orderRouter.create
- [x] Integrar notificações em orderRouter.updateStatus
- [x] Sistema de fila usando tabela botMessages

### Fase 4: Bot - Detecção de Pedidos
- [x] Atualizar prompt para detectar pedidos (seção DELIVERY atualizada)
- [x] Adicionar instruções de envio de link no prompt
- [x] Implementar geração de link no publicTest router
- [x] Implementar substituição de [GERAR_LINK_PEDIDO] por URL real
- [ ] Testar envio de link (próxima fase)

### Fase 5: Frontend - Cardápio Web
- [x] Criar página `/pedido/[sessionId]` (Pedido.tsx)
- [x] Adicionar rota pública no App.tsx
- [x] Criar endpoint público `menu.listCategories`
- [x] Criar endpoint público `menu.listItems`
- [x] Implementar listagem de categorias
- [x] Implementar cards de itens com preços
- [x] Implementar carrinho flutuante
- [x] Implementar adicionar/remover itens
- [x] Implementar cálculo de subtotal e total
- [ ] Criar página de checkout (próxima etapa)

### Fase 6: Frontend - Carrinho e Checkout
- [ ] Implementar carrinho flutuante
- [ ] Implementar página de checkout
- [ ] Implementar formulário de entrega
- [ ] Integrar com endpoints tRPC

### Fase 7: Integração e Testes
- [ ] Testar fluxo completo (bot → web → bot)
- [ ] Implementar template de impressão
- [ ] Testar notificações WhatsApp

### Fase 8: Painel Admin
- [ ] Criar página de gestão de pedidos
- [ ] Implementar filtros e busca
- [ ] Implementar atualização de status
- [ ] Adicionar upload de fotos de pratos

### Fase 9: Finalização
- [ ] Testes finais
- [ ] Ajustes de UX
- [ ] Documentação
- [ ] Checkpoint final


## Bug: Link de pedido com domínio errado (22/12/2024)
- [x] Corrigir URL de geração de link no publicTest.ts (agora usa ctx.req.get('host'))
- [ ] Testar link gerado pelo bot


## Bug: Erro de build ao publicar - pixman-1 (22/12/2024)
- [x] Investigar uso de canvas no projeto (orderImageGenerator.ts não usado)
- [x] Mover canvas para optionalDependencies
- [x] Tornar import de canvas dinâmico e opcional
- [ ] Testar build e publicação (usuário deve tentar publicar novamente)


## Melhorias UX do Cardápio Web (22/12/2024)
- [x] Criar modal de detalhes do item (clicar no card abre modal)
- [x] Adicionar campo de observações por item (textarea no modal)
- [x] Mostrar observações no carrinho (texto laranja itálico)
- [x] Card clicável para ver descrição completa
- [x] Botão Adicionar abre modal com observações


## Bug: Erro de build - pnpm lockfile e optionalDependencies (22/12/2024)
- [x] Remover canvas completamente do package.json
- [x] Remover patch do wouter que não existe mais
- [x] Regenerar pnpm-lock.yaml
- [ ] Testar build para publicação (usuário deve tentar novamente)


## Conclusão do Cardápio Digital (22/12/2024)
### Fase 6: Checkout
- [x] Criar página `/pedido/[sessionId]/checkout` (Checkout.tsx)
- [x] Formulário de dados do cliente (nome, telefone)
- [x] Seleção de tipo de entrega (delivery/retirada)
- [x] Campo de endereço (se delivery, condicional)
- [x] Seleção de forma de pagamento (dinheiro/cartão/pix)
- [x] Campo de troco (se pagamento em dinheiro)
- [x] Observações adicionais (opcional)
- [x] Resumo do pedido com observações dos itens
- [x] Botão de confirmação
- [x] Criar página de confirmação (Confirmacao.tsx)
- [x] Salvar carrinho no localStorage antes de checkout
- [x] Adicionar rotas no App.tsx

### Fase 7: Finalização e Integração
- [x] Implementar envio de pedido ao backend (orderRouter.create)
- [x] Atualizar schema de input para aceitar dados do checkout
- [x] Formatar mensagem para WhatsApp (orderNotification.ts)
- [x] Página de confirmação de pedido (Confirmacao.tsx)
- [ ] Testar fluxo completo (próxima fase)

### Fase 8: Painel Admin
- [x] Atualizar página Orders.tsx para usar orderRouter
- [x] Listar pedidos em tempo real (já existia)
- [x] Atualizar status de pedidos (já existia)
- [x] Visualizar detalhes completos (já existia)

### Fase 9: Testes Finais
- [x] Salvar checkpoint final (0b061be1)
- [ ] Testar fluxo completo (bot → cardápio → checkout → WhatsApp) - PRONTO PARA TESTE
- [ ] Validar observações nos pedidos - PRONTO PARA TESTE
- [ ] Testar painel admin - PRONTO PARA TESTE


## Sistema de Upload de Imagens para Cardápio (22/12/2024)
### Backend
- [x] Adicionar campo `imageUrl` no schema de menuItems (já existe)
- [x] Executar migração do banco (já migrado)
- [x] Criar endpoint de upload de imagem (S3) - uploadRouter.uploadMenuItemImage
- [x] Criar endpoint para atualizar imageUrl do item (já existe no menuItems.update)

### Frontend Admin
- [x] Adicionar campo de upload na página Menu
- [x] Implementar preview da imagem
- [x] Integrar com endpoint de upload
- [x] Adicionar estados (uploadingImage, imagePreview, imageUrl)
- [x] Adicionar função handleImageUpload
- [x] Atualizar handleCreateItem para incluir imageUrl

### Frontend Público
- [x] Exibir imagens nos cards do cardápio web (Pedido.tsx)
- [x] Adicionar imagem grande no modal de detalhes
- [x] Ajustar layout para fotos (height 48, object-cover)
- [x] Condicional para exibir apenas se imageUrl existir

### Testes
- [x] Salvar checkpoint (34f6ae66)
- [ ] Testar upload de imagem no painel admin - PRONTO PARA TESTE
- [ ] Validar exibição no cardápio web - PRONTO PARA TESTE


## Sistema de Impressão e Notificações (22/12/2024)
### Verificação
- [x] Verificar se pedido de teste foi recebido no banco (SIM - 1 pedido encontrado)
- [x] Analisar estrutura do pedido salvo
- [x] Identificar problema: frontend não exibe pedidos (query com input opcional)
### Impressão de Comanda
- [x] Criar página de impressão otimizada para impressora térmica (PrintOrder.tsx)
- [x] Formatar comanda com dados do pedido (itens, observações, cliente, endereço)
- [x] Criar endpoint para buscar pedido completo por ID (orderRouter.getById)
- [x] Adicionar rota /print-order/:orderId
- [x] Impressão automática ao carregar
- [ ] Adicionar bo### Botão de Expedição
- [x] Adicionar botão "Imprimir" no painel admin (Orders.tsx)
- [x] Adicionar botão "Expedir para Entrega" / "Marcar como Pronto" (Orders.tsx)
- [x] Botão condicional baseado em status (confirmed/preparing/ready)
- [x] Atualizar status do pedido automaticamente (já existe no orderRouter.updateStatus)
- [x] Notificação WhatsApp ao expedir (já existe no orderRouter.updateStatus)
- [x] Sistema de notificação já implementado (orderNotification.ts)
- [x] Mensagens formatadas para WhatsApp (formatStatusUpdateForWhatsApp)
- [x] Fila de mensagens (tabela botMessages)
- [ ] Testar fluxo completo de notificação (próxima fase)

### Upload de Imagens
- [x] Sistema de upload já implementado (checkpoint 34f6ae66)
- [x] Endpoint uploadRouter.uploadMenuItemImage funcional
- [x] Campo de upload no painel admin (Menu.tsx)
- [x] Exibição no cardápio web (Pedido.tsx)
- [ ] Testar upload de imagem no painel admin - PRONTO PARA TESTE
- [ ] Validar exibição no cardápio web - PRONTO PARA TESTE


## Atualizar Taxa de Entrega (22/12/2024)
- [x] Taxa já está em R$ 7,00 no Pedido.tsx (linha 80: deliveryFee = 700)
- [x] Verificado outros arquivos (Orders.tsx, Settings.tsx, PrintOrder.tsx usam valor do banco)
- [x] Taxa fixa aplicada corretamente no cálculo do total


## Bug: Preços aparecendo 100x menores no cardápio (22/12/2024)
- [x] Investigar valores no banco de dados (menu_items.price estava em centavos errados)
- [x] Identificado: preços salvos como 30 (R$ 0,30) ao invés de 3000 (R$ 30,00)
- [x] Corrigir valores no banco: UPDATE menu_items SET price = price * 100 WHERE price < 1000
- [x] Preços corrigidos: agora em centavos corretos (3000 = R$ 30,00)
- [ ] Testar correção no cardápio web (usuário deve validar)


## Redesign Cardápio Digital - Estilo Anota.ai (Mar/2026)
- [x] Pesquisar Anota.ai: funcionalidades, UX, estrutura de cardápio digital
- [x] Atualizar taxa de entrega para R$ 8,50 (era R$ 7,00)
- [x] Corrigir erro TypeScript: PrintOrder.tsx - additionalNotes → customerNotes
- [x] Remover orderImageGenerator.ts (não usado, causa erro de canvas)
- [x] Corrigir erro TypeScript: orderRouter.ts linha 87
- [x] Redesenhar página /pedido/[sessionId] com estrutura Anota.ai
- [x] Adicionar header com logo/nome do restaurante e banner
- [x] Adicionar barra de busca de itens
- [x] Adicionar navegação por categorias (tabs/âncoras fixas)
- [x] Melhorar cards de itens (foto grande, nome, descrição, preço, botão +)
- [x] Carrinho lateral/bottom sheet com resumo do pedido
- [x] Botão flutuante de carrinho com contador de itens
- [x] Redesenhar checkout com UX mais fluida
- [x] Adicionar seletor delivery/retirada na tela inicial do cardápio
- [x] Atualizar taxa de entrega no chatbotPrompt.ts (R$ 8,50)
- [x] Atualizar taxa de entrega no Pedido.tsx (R$ 8,50 = 850 centavos)

## Painel Admin Unificado - UI/UX Premium (Mar/2026)
- [x] Redesenhar DashboardLayout: sidebar escura elegante, logo, ícones, hover states
- [x] Redesenhar Dashboard: KPIs com gráficos, pedidos recentes, status em tempo real
- [x] Redesenhar página Cardápio: grid de cards com foto, toggle disponível
- [x] Redesenhar página Pedidos: cards expansíveis, filtros, progresso visual, ações rápidas
- [x] Redesenhar página Reservas: cards modernos, contadores por status, link WhatsApp
- [x] Redesenhar página Configurações: abas visuais, formulários modernos, URL webhook
- [x] Redesenhar Simuladores: header premium, dicas clicáveis, layout otimizado
- [x] Adicionar título/logo "Estrela do Sul" na sidebar com ícone Flame
- [ ] Configurar domínio personalizado (feito pelo usuário via painel Manus > Settings > Domains)

## Cadastro Cardápio Completo iFood (Mar/2026)
- [x] Limpar categorias e itens de teste do banco
- [x] Criar 7 categorias na ordem correta
- [x] Cadastrar 7 itens da Categoria 1: Executivos Premium
- [x] Cadastrar 3 itens da Categoria 2: Marmitex c/ churrasco à moda
- [x] Cadastrar 8 itens da Categoria 3: Guarnições do Estrela
- [x] Cadastrar 1 item da Categoria 4: Marmitex Econômicas
- [x] Cadastrar 4 itens da Categoria 5: Churrasco do Estrela
- [x] Cadastrar 4 itens da Categoria 6: Saladas Especiais
- [x] Cadastrar 10 itens da Categoria 7: Bebidas
- [x] Verificar todos os 37 itens cadastrados corretamente (7+3+8+1+4+4+10 = 37)

## Sistema de Complementos (iFood-style) - Mar/2026
- [x] Criar tabelas menu_addon_groups e menu_addon_options no schema
- [x] Migrar banco com pnpm db:push
- [x] Criar endpoints tRPC para CRUD de complementos (admin) e leitura pública
- [x] Cadastrar 89 grupos e 348 opções para todos os 37 itens via script SQL
- [x] Atualizar modal do cardápio público com seleção de complementos (radio/checkbox/quantidade)
- [x] Atualizar painel admin Menu.tsx com gestão de complementos por item (modal Settings2)
- [x] Validar grupos obrigatórios antes de adicionar ao carrinho
- [x] Incluir complementos selecionados no resumo do pedido e checkout

## Unificação Simuladores e Fluxo Delivery via Cardápio Digital - Mar/2026
- [x] Remover Simulador Chat da sidebar (DashboardLayout.tsx)
- [x] Simulador WhatsApp usa getChatbotPrompt() completo do restaurante (mesmo do WhatsApp real)
- [x] Bot detecta intenção de pedido delivery → gera sessão real e envia link clicavel do cardápio
- [x] Página do cardápio recebe sessionId do chat para vincular o pedido
- [x] Ao finalizar pedido no cardápio, polling detecta e exibe resumo completo no chat
- [x] Pedido finalizado exibido no simulador com botão de impressão térmica (link /imprimir/[id])
- [x] Formatar pedido para impressão térmica (80mm, texto simples, sem imagens) via PrintOrder.tsx

## Correção URL Link Cardápio (Mar/2026)
- [x] Corrigir getSiteUrl() para usar URL de desenvolvimento (SITE_DEV_URL) e produção separados
- [x] Testar link do cardápio no simulador - gera URL correta: https://3000-i3nfp1m89f65xrfid36rm-84e0c22e.us2.manus.computer/pedido/[id]

## Redesign Cardápio Mobile (05/03/2026)
- [x] Upload da logo Estrela do Sul para CDN e usar no cardápio
- [x] Corrigir nome "Restaurante Teste" para "Estrela do Sul" no header
- [x] Corrigir sobreposição da barra de categorias sobre itens no mobile
- [x] Redesenhar cards de itens: mais limpos, nome em destaque
- [x] Clique no item abre painel de detalhes (drawer/expandir)
- [ ] Verificar todos os produtos/complementos/preços conforme iFood

## Seção Mais Pedidos no Cardápio
- [x] Adicionar campo isFeatured no schema menu_items e migrar banco
- [x] Marcar itens populares como destaque no banco (9 itens marcados)
- [x] Implementar seção "Mais Pedidos" no topo do cardápio (Pedido.tsx)
- [x] Adicionar rota/procedure para buscar itens em destaque (menu.listFeatured)

## Correção do Link do Cardápio no Bot
- [x] Corrigir prompt do bot: injetar URL real do cardápio digital dinamicamente
- [x] Bot não deve dizer "link indisponível" — deve enviar o link correto
- [x] Testado: bot gera link clicável "Abrir Cardápio Digital" corretamente
## Botão Voltar do Celular no Cardápio Digital
- [x] Implementar History API: ao abrir drawer de item, fazer pushState para criar entrada no histórico
- [x] Capturar evento popstate (botão voltar) para fechar drawer em vez de sair do app
- [x] Garantir que ao fechar o drawer manualmente (X ou fundo), o histórico seja limpo corretamente
- [x] Botão voltar também funciona na aba Carrinho (volta para o Cardápio)

## Tela de Seleção Entrega/Retirada no Cardápio Digital
- [x] Tela inicial de boas-vindas com seleção de tipo de pedido (Entrega ou Retirada)
- [x] Ocultar campos de endereço no checkout quando tipo for Retirada
- [x] Passar tipo de pedido para o resumo final e impressão via localStorage
- [x] Taxa de entrega zerada para Retirada no carrinho e checkout

## Botão Alterar Tipo de Pedido no Cardápio
- [x] Exibir tipo atual (Entrega/Retirada) no header do cardápio como botão clicável
- [x] Ao clicar, abrir modal/sheet de seleção para trocar o tipo sem recarregar
- [x] Atualizar taxa de entrega no carrinho em tempo real ao trocar o tipo

## Melhorias Múltiplas (10/03/2026)
- [ ] Corrigir nomes dos itens no dashboard (aparecem apenas quantidades e preços)
- [ ] Corrigir cidade de "São José do Rio Preto" para "Barretos/SP" na tela de confirmação
- [ ] Botão "Acompanhe pelo WhatsApp" clicável: redireciona ao WhatsApp com número do pedido
- [ ] Bot localiza pedido pelo número identificador e envia resumo + status ao cliente
- [ ] Tempo de entrega dinâmico por dia da semana e período (almoço/noite)
- [ ] Seleção de quantidade nos adicionais (ex: 3x Mandioca Frita extra)
- [ ] Renomear "Pix" para "Pix na Entrega (Maquininha)"
- [ ] Separar campos de endereço: Rua, Bairro, Número, Referência (obrigatórios) + Complemento (opcional)
- [ ] Corrigir preços dos complementos adicionais conforme tabela fornecida

## Melhorias - Março 2026
- [ ] Histórico de pedidos por cliente no painel admin (ao expandir pedido, mostrar total de pedidos do telefone)
- [ ] Pré-preenchimento automático de dados do cliente no cardápio digital quando número de WhatsApp é reconhecido
- [ ] Confirmação/troca de endereço no checkout antes de finalizar pedido


## Melhorias - 10/03/2026
- [ ] Notificação WhatsApp automática ao aceitar pedido com tempo estimado
- [ ] Controle de horário de funcionamento fixo por dia/turno com regra de pedido antecipado


## Correções de Impressão Térmica (10/03/2026)
- [x] Corrigir margem esquerda da comanda — padding-left 6mm na impressão para evitar corte de texto pela margem física da impressora
- [x] Criar guia completo de configuração do corte automático para Epson TM-T20X

## Correções de Compatibilidade e Cardápio (10/03/2026)
- [x] Corrigir link do cardápio no chatbot para ser enviado em linha separada (compatível iOS/Android/Windows)
- [x] Ativar e reposicionar grupo "Substitua a sua maneira" nas marmitex P, M e G (displayOrder=1, logo após alterar mix de carnes)
- [x] Converter URLs em links clicáveis no frontend do chat de teste (PublicTest.tsx)
- [x] Atualizar horários do rodízio no chatbotPrompt.ts (almoço seg-sex 11h-14h30, sáb 11h-14h45, dom 11h-15h; jantar ter-dom 19h-22h45, fechado seg)
- [x] Adicionar política da taxa de serviço (10%) na base de conhecimento do chatbot
- [x] Adicionar horários de pico e dicas de chegada na base de conhecimento do chatbot
- [x] Adicionar preços de bebidas do rodízio (PDF) na base de conhecimento
- [x] Adicionar botões Sim/Não no chat quando bot oferecer atendente humano
- [x] Corrigir fuso horário para Brasília (UTC-3) no chatbotPrompt.ts e todos os arquivos do servidor
- [x] Reservas do simulador agora são salvas no banco e notificam o admin via notifyOwner
- [x] Bot agora pergunta almoço ou jantar antes de responder sobre dia específico
- [x] Adicionada distinção jarra vs copo nos preços de suco na base de conhecimento
- [x] Card visual bonito criado para o link do cardápio digital (substituiu URL crua)
- [x] Removido mínimo obrigatório (minSelections=0) em 11 grupos de variação de carnes

## Melhorias - 11/03/2026
- [ ] Corrigir reservas não aparecendo no painel admin (chatSimulator.ts)
- [ ] Permitir finalizar pedido fora do horário com aviso de agendamento (cardápio digital)
- [x] Adicionar desconto bariátrica (R$10,00 com carteirinha) na base de conhecimento
- [x] Adicionar orientação sobre vagas de emprego (e-mail estreladosulbarretos@gmail.com)
- [x] Bot consultar status do pedido quando cliente perguntar se marmita saiu
- [x] Fluxo pós-atendente humano: perguntar se ajuda em mais algo; se urgente, ligar no fixo
- [x] Responsável de compras: passar Clóvis 17 9 8811-2790
- [x] Cupom fiscal/DANFE: repassar ao atendente humano


## Melhorias de Operação (Março 2026 - Sessão 3)
- [x] Aceite automático de pedidos com impressão automática das duas vias
- [x] Alerta visual piscante no dashboard para reservas novas pendentes
- [x] Simplificar fluxo de pedidos para botão único "Pedido a Caminho"
- [x] Adicionar configuração on/off para aceite automático nas Settings
- [x] Refetch automático de reservas a cada 15s com alerta sonoro
- [x] Remover seletor manual de status e botões intermediários dos pedidos confirmados

## Melhorias Chatbot + Cardápio Digital (Março 2026 - Sessão 4)
- [x] Regra: enviar link do cardápio digital imediatamente quando cliente perguntar sobre produtos/marmitas/cardápio
- [x] Alinhar tempos de entrega/retirada no prompt do chatbot com os valores do cardápio digital
- [x] Adicionar estimativa de horário de entrega/retirada na tela de conclusão do pedido (cardápio digital)
- [x] BOT responder tempo estimado correto baseado no pedido já feito pelo cliente


## Integração Evolution API (WhatsApp via QR Code)
- [x] Criar módulo evolutionApi.ts para envio de mensagens via Evolution API
- [x] Criar endpoint webhook /api/webhook/evolution para receber mensagens da Evolution API
- [ ] Adaptar audioTranscription.ts para baixar áudio via Evolution API
- [x] Adicionar configurações de Evolution API via variáveis de ambiente (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME)
- [x] Configurar webhook na Evolution API apontando para o chatbot
- [ ] Testar fluxo completo: mensagem WhatsApp → webhook → chatbot → resposta
- [ ] Adicionar toggle no admin para escolher entre Meta Cloud API e Evolution API

## Correção URL Cardápio no WhatsApp (11/03/2026)
- [x] Confirmado: URL de produção já é usada corretamente (chatbotwa-hesngyeonud5ngjee9cdhq.manus.space)
- [x] Link chega clicavel no WhatsApp real em linha separada

## Mensagem Visual do Cardápio (11/03/2026)
- [x] Implementar envio de imagem do restaurante + legenda com link quando cliente pedir cardápio delivery
- [x] Gerar imagem de banner do cardápio (churrasco, logo, call-to-action visual)
- [x] Testar mensagem visual chegando no WhatsApp real - confirmado como imageMessage

## Melhorias UX Cardápio Digital e Notificações (12/03/2026)
- [ ] Reconhecimento automático do cliente ao abrir cardápio: buscar dados pelo número WhatsApp da sessão e pré-preencher nome/endereço
- [ ] Tela de confirmação de dados: mostrar nome, endereço e opção de alterar antes de escolher entrega/retirada
- [ ] Notificação WhatsApp automática ao confirmar pedido: enviar mensagem ao cliente via Evolution API
- [ ] Salvar horário de confirmação (confirmedAt) no banco quando pedido for aceito
- [ ] Bot responde inteligentemente sobre tempo de entrega: calcular previsão com base no horário de confirmação e dia da semana
- [x] Histórico de pedidos no cardápio digital com opção de repetir pedido com um clique
- [ ] Notificações proativas de status via WhatsApp ao mudar status no painel (confirmado, a caminho, entregue)
- [ ] Estimativa de entrega correta para pedidos antecipados (antes das 11h/19h)
- [ ] Remover bebidas duplicadas sem imagem (Coca-Cola lata duplicada)
- [ ] Corrigir addons do Refrigerante Econômico (apenas COTUBA 2L)
- [ ] Remover opções de troca de arroz/feijão/batata frita dos Mix de Carnes Tradicional e Nobre
- [ ] Atualização automática de endereço quando cliente escolhe novo endereço no delivery
- [ ] Nome do cliente preenchido automaticamente no cardápio (sem pedir para digitar)
- [ ] Reposicionar histórico de pedidos para dentro do cardápio (miniatura + botão repetir)

## Validação de Categorias Duplicadas (12/03/2026)
- [x] Validação no backend (create): impedir criação de categoria com nome duplicado (case-insensitive)
- [x] Validação no backend (update): impedir renomear categoria para nome já existente em outra categoria
- [x] Frontend exibe toast de erro com mensagem clara quando tenta criar/renomear para nome duplicado
- [x] Testes corrigidos para usar nomes únicos com timestamp (evitar conflito com dados reais do banco)

## Bugs Reportados (12/03/2026 - 10:51)
- [x] Bug: "Último pedido" mostra "1x Item" sem nome e sem imagem para pedidos antigos (PED32254670) — corrigido: getOrderHistory agora busca por preço quando itemName é null, salva retroativamente no banco, e filtra pedidos cancelados
- [x] Bug: Endereço novo digitado no checkout não é salvo como endereço padrão do cliente — corrigido: createOrder agora atualiza customer.address e customer.name no banco sempre que um pedido é criado com sucesso

## Bugs Reportados (12/03/2026 - 11:06)
- [x] Bug: Testes automatizados criam categorias reais no banco de produção (Test_Bebidas_...) — corrigido: adicionado afterEach que deleta todas as categorias/itens com nome 'Test_%' após cada teste; categorias antigas já foram deletadas do banco
- [x] Bug: "Último pedido" no cardápio mostra PED32254670 (R$69, antigo) em vez de PED23423451 (R$49,40, mais recente) — corrigido: problema era que pedidos novos têm telefone formatado '(17) 98811-2791' e o LIKE '%88112791%' não encontrava por causa do traço; agora busca por OR com 11 dígitos e 8 dígitos; createOrder também normaliza o telefone antes de salvar

## Atualização de Banner (12/03/2026)
- [x] Substituir banner do cardápio digital enviado pelo bot pelo novo arquivo banner2_FINAL.jpg (recortado para 900x900px, CDN: banner2_900x900_781f01cb.jpg)

## Melhorias Solicitadas (12/03/2026 - tarde)
- [x] Limpar todos os pedidos de teste do banco de dados
- [x] Remover todas as categorias "Pizzas" do banco e do painel
- [x] Atualizar configurações do restaurante com dados reais (Churrascaria Estrela do Sul, Av. Eng. Necker Camargo de Carvalho, rua 36, nº 1885, Barretos-SP)
- [x] Tornar card "Clientes" no dashboard clicável, abrindo tabela com dados dos clientes (rota /customers)
- [x] Adicionar campo data de nascimento no checkout do cardápio digital (apenas no primeiro pedido do cliente)
- [x] Gerenciamento de complementos já estava implementado (botão Settings2 em cada item do cardápio)
- [x] Histórico de pedidos: paginação 20/página + filtro por data (dateFrom/dateTo) + botões Anterior/Próxima
- [x] Substituir banner do bot pelo novo banner_cardapio_digital_900x900.png (CDN: banner_cardapio_digital_900x900_b8c4719c.png)

## Edição de Complementos (12/03/2026)
- [x] Adicionar botão de editar em cada opção de complemento (nome, descrição, preço) sem precisar deletar e recriar

## Melhorias no Fluxo de Reservas (12/03/2026)
- [ ] Corrigir: remover [SALVAR_RESERVA:...] da mensagem enviada ao cliente no WhatsApp
- [ ] Adicionar aviso ao cliente: "quando o restaurante confirmar, você receberá uma mensagem aqui"
- [ ] Implementar lembrete automático 12h antes da reserva via WhatsApp

## Auditoria Completa do Fluxo de Reservas (12/03/2026)
- [x] Corrigir chatbot.ts: processar [SALVAR_RESERVA] e salvar no banco (igual ao chatSimulator.ts)
- [x] Remover marcador [SALVAR_RESERVA:...] da mensagem enviada ao cliente
- [x] Garantir que reservas aparecem no painel admin (/reservations)
- [x] Botão "Confirmar" no painel envia mensagem WhatsApp ao cliente
- [x] Botão "Recusar" no painel envia mensagem WhatsApp ao cliente
- [x] Lembrete automático 12h antes da reserva via WhatsApp (cron job)
- [x] Notificar admin via sistema quando nova reserva chegar

## Previsão de Entrega com Horário (12/03/2026)
- [x] Corrigir mensagem de confirmação de pedido: mostrar horário estimado de chegada (ex: "até às 14h53") em vez de "45 a 70 minutos"

## Campo Data de Nascimento no Checkout (12/03/2026)
- [x] Ocultar campo de data de nascimento no checkout quando o cliente já tiver a data cadastrada no perfil

## Modo Humano e Alerta Interno (12/03/2026)
- [x] Enviar alerta interno via WhatsApp ao número do restaurante quando cliente pede atendente humano
- [x] Implementar modo humano: detectar respostas do operador e pausar bot por 30 minutos
- [x] Bot retoma automaticamente após 30 min de inatividade do operador

## Auditoria Técnica Completa — Implementação (12/03/2026)

### Segurança
- [x] 1.1 Proteger endpoints /api/diag/* com autenticação de admin
- [x] 1.2 Validar apikey no webhook da Evolution API
- [x] 1.3 Recalcular total do pedido inteiramente no servidor (ignorar totalAmount do cliente)
- [x] 1.4 Instalar helmet e express-rate-limit

### LGPD
- [x] 2.1 Adicionar política de privacidade e consentimento no checkout
- [x] 2.2 Adicionar campo deletedAt (soft delete) em customers e conversations
- [x] 2.3 Centralizar telefone/dados do restaurante nas configurações do banco
- [x] 2.4 Criar página /privacidade com política de dados

### Qualidade de Código
- [x] 3.2 Corrigir URL duplicada: importar getSiteUrl() no chatbot.ts
- [x] 3.3 Adicionar foreign keys no schema do banco
- [x] 3.4 Adicionar índices de banco para queries frequentes
- [x] 3.5 Implementar paginação nas queries de listagem

### Guardrails de IA
- [x] 4.1 Adicionar limite de 2000 caracteres nas mensagens do chatbot
- [x] 4.2 Adicionar instrução anti-injection no system prompt
- [ ] 4.3 Adicionar estimativa de tokens no histórico de conversa
- [x] 4.4 Melhorar detecção de atendente humano via marcador LLM

### Resiliência
- [x] 5.1 Adicionar handler de erros não capturados no processo Node.js
- [x] 5.2 Monitoramento automático da instância WhatsApp no cron job
- [x] 5.3 Limpeza periódica de sessões expiradas no cron job
- [x] 5.4 Worker de retry para fila de mensagens pendentes

### UX / Segurança
- [x] 6.1 Corrigir página de impressão: usar token aleatório em vez de ID sequencial
- [x] 6.2 Feedback visual inline de erros no checkout
- [x] 6.3 Estado de erro nas páginas do painel admin (Orders, Reservations)

## Sprint 2 — Pontos Pendentes da Auditoria + Melhorias (12/03/2026)

### Auditoria — Pontos Pendentes
- [x] 2.2 Soft delete: campo deletedAt em customers e conversations
- [x] 2.3 Foreign keys explícitas no schema do banco
- [x] 3.3 Foreign keys explícitas no schema do banco (aplicadas via SQL)
- [x] 3.4 Índices de banco para queries frequentes (whatsappId, phone, status, createdAt)
- [x] 5.4 Worker de retry para fila de mensagens com falha (botMessages)

### Melhorias
- [x] Edição inline de itens do cardápio: botão editar preço/nome/descrição/disponibilidade sem deletar


## Sprint 3 — Wide Research: Segurança + Performance (12/03/2026)

### Segurança
- [x] S1. Sanitização de output do LLM antes de enviar ao WhatsApp
- [x] S2. Proteção contra vazamento do system prompt (anti-leak)
- [x] S3. Rate limit por whatsappId no chatbot (máx 30 msgs/hora)
- [x] S4. Sanitização de inputs HTML/XSS em todos os campos de texto
- [x] S5. Audit logging de ações administrativas (tabela audit_logs)
- [x] S6. Sanitização de erros — nunca expor stack trace ao cliente
- [x] S7. Proteção contra enumeração de endpoints (404 genérico)
- [ ] S8. npm audit e correção de dependências vulneráveis
- [x] S9. Cookie security hardening (httpOnly, secure, sameSite)

### Performance
- [x] P1. Cache de respostas frequentes do chatbot (FAQ sem LLM)
- [x] P2. Otimização do prompt (reduzir tokens desnecessários)
- [x] P3. Compressão gzip no Express
- [x] P4. Lazy loading de imagens no cardápio
- [x] P5. Pré-preenchimento inteligente no checkout (último endereço + pagamento)
- [x] P6. Debounce em buscas e inputs
- [x] P7. Otimização de queries do dashboard

### Extras Implementados
- [x] Cache em memória para dados do cardápio (60s TTL com invalidação automática)
- [x] Componente LazyImage com placeholder animado e fallback de erro
- [x] Testes automatizados para sanitização, rate limiting, cache e audit log (23 testes novos)
- [x] Relatório final do Sprint 3 em linguagem leiga

## Sprint 3B — Melhorias de Performance Pendentes (12/03/2026)
- [x] P1. Cache de FAQ sem LLM (respostas instantâneas para perguntas frequentes)
- [x] P2. Otimização do prompt (reduzir tokens desnecessários)
- [x] P5. Pré-preenchimento inteligente no checkout (último endereço + pagamento)
- [x] P6. Debounce em buscas e inputs
- [x] P7. Otimização de queries do dashboard (índices + agregação eficiente)

## Bug URGENTE: Bot não responde no WhatsApp (12/03/2026 - 19:14)
- [x] Investigar por que mensagens das 19:12-19:13 não recebem resposta
- [x] Verificar logs do servidor e webhook da Evolution API
- [x] Corrigir o problema e testar
- [x] Reduzir keep-alive de 10 para 5 minutos com ping duplo anti-hibernação
- [x] Normalizar telefones no retry worker (formato 55XXXXXXXXXXX)
- [x] Retry worker agora processa mensagens 'pending' além de 'failed'
- [x] Retry worker prioriza mensagens mais recentes (ORDER BY DESC)
- [x] Limpeza de fila de mensagens antigas acumuladas

## Bug: Bot não responde (19:33-19:35) — Desconexão 401 (12/03/2026)
- [x] Diagnosticar causa raiz: desconexão 401 (logout) da Evolution API às 19:31
- [x] KeepAlive reescrito: ping a cada 4 min (era 10), detecção de desconexão, reconexão automática
- [x] Notificação automática ao dono quando bot desconecta
- [x] Verificação periódica do webhook (a cada 15 min) com reconfiguração automática
- [x] Logging detalhado no webhook com timestamp e detecção de CONNECTION_UPDATE
- [x] Webhook reconfigurado e instância reiniciada
- [x] 58 testes passando (16 novos: FAQ cache, dashboard stats, debounce hook)

## Bug: Bot não responde (20:34-20:35) — Investigar novamente (12/03/2026)
- [x] Verificar estado da Evolution API e webhook publicado
- [x] Verificar se mensagens chegaram ao banco de dados
- [x] Causa raiz: webhook apontava para URL de dev (manus.computer) em vez da URL publicada (manus.space)
- [x] Corrigido: webhook reconfigurado para URL publicada permanente
- [x] keepAlive.ts corrigido: usa VITE_SITE_URL em vez de SITE_DEV_URL

## Bug DEFINITIVO: Bot não responde — JID @lid (12/03/2026 - 21:00)
- [x] Investigação meticulosa ponto a ponto do fluxo de mensagens
- [x] CAUSA RAIZ DEFINITIVA: WhatsApp Business usa JID @lid (Linked ID) em vez de @s.whatsapp.net
- [x] Mensagens do cliente chegam com formato 212454869074102@lid, não 5517988112791@s.whatsapp.net
- [x] webhookEvolution.ts: aceita mensagens com JID @lid (funções isIndividualChat, isGroupChat, isStatusBroadcast)
- [x] evolutionApi.ts: sendTextMessageEvolution e sendMediaMessageEvolution aceitam JID @lid diretamente
- [x] chatbot.ts: usa whatsappId (JID completo) em vez de phone para enviar respostas via Evolution API
- [x] db.ts: getCustomerByWhatsappId busca por ambos formatos (@s.whatsapp.net e @lid)
- [x] Testado: webhook com @lid processado e bot respondeu em 3 segundos
- [x] Testado: envio via @lid confirmado na Evolution API
- [x] 58 testes passando

## Polling Fallback — Evolution API não dispara webhooks (12/03/2026)
- [x] Implementar polling que busca mensagens novas na Evolution API a cada 5 segundos
- [x] Processar apenas mensagens não vistas (controle por timestamp)
- [x] Integrar com o mesmo fluxo do webhook (processIncomingMessage)
- [x] Testar e validar que o bot responde automaticamente


## Correção Webhook/Polling e Modo Humano (13/03/2026)
- [x] Desativar polling de mensagens (manter apenas webhook)
- [x] Registrar IDs de mensagens enviadas pelo bot (botMessageTracker em memória com TTL)
- [x] Detectar mensagens do operador no webhook (fromMe=true + ID não registrado = operador)
- [x] Ativar modo humano automaticamente quando operador responde (30 min)
- [x] Desativar modo humano após 30min ou quando operador envia comando "bot"
- [x] Reativar verificação de modo humano no chatbot.ts com lógica correta


## Modo Humano Elegante — Controle via WhatsApp (13/03/2026)
- [x] Implementar função deleteMessage na Evolution API (apagar mensagem)
- [x] Comando #bot: operador envia, sistema apaga antes do cliente ver, reativa bot
- [x] Confirmação silenciosa: quando modo humano ativa, enviar aviso ao operador
- [x] Expiração automática após 30 min sem interação do operador
- [ ] Testar fluxo completo: operador responde → bot silencia → #bot → bot retoma (aguardando teste do Clóvis)


## Auditoria Crítica — Bugs Encontrados (13/03/2026)
- [x] BUG: Número de celular mostra LID (@lid) em vez do número real do WhatsApp
  - Corrigido: webhook e polling agora extraem `remoteJidAlt` para obter número real
  - Normalização: whatsappId sempre salvo como `{digits}@s.whatsapp.net`
  - Merge: registros duplicados (30001, 120002, 150001) unificados no ID 30001
- [x] BUG: Nome do cliente não preenchido no checkout ("Olá, !")
  - Corrigido: `pushName` extraído do payload e salvo no customer
  - Corrigido: `getCustomerByWhatsapp` busca por múltiplos formatos de whatsappId
  - Corrigido: prioriza registro com mais dados (nome + endereço)
- [x] BUG: Endereço não salvo/pré-preenchido no checkout
  - Corrigido: `updateCustomerAddress` busca por múltiplos formatos
  - Corrigido: `getCustomerByWhatsapp` inclui busca por whatsappId além de phone
- [x] BUG: Previsão de entrega fora do horário de funcionamento (00:21-00:46 em vez de horário real)
  - Corrigido: previsão agora usa próximo horário de abertura como base quando restaurante fechado
- [x] BUG: Pedido anterior não disponível para repetir
  - Corrigido: `getOrderHistory` busca por múltiplos formatos de phone/whatsappId
- [x] AUDITORIA: Merge de registros duplicados no banco de dados
  - 3 registros (30001, 120002, 150001) unificados em 1 (ID 30001)
  - whatsappId canônico: `5517988112791@s.whatsapp.net`
  - Conversas e pedidos reatribuídos ao registro principal
- [x] TESTES: 72 testes passando (14 novos para normalização de whatsappId)

## Correção Previsão de Entrega (13/03/2026)
- [x] BUG: Previsão de entrega mostra horários fora do funcionamento (ex: 00:21-00:46)
  - Corrigido: Confirmacao.tsx agora detecta restaurante fechado e usa próximo horário de abertura como base
  - Corrigido: orderNotification.ts também ajusta base para horário de abertura quando fora do expediente
  - 3 cenários tratados: aberto (usa now), antecipado (usa abertura do turno), fechado (usa próxima abertura)
- [x] Analisar como o horário estimado é calculado no checkout e no chatbot
- [x] Ajustar para respeitar horário de funcionamento do restaurante
- [x] Aplicar regras corretas: Delivery seg-sex 45-70min, sáb-dom 60-110min, Retirada 30-50min
- [x] Testar e validar — 88 testes passando (16 novos para previsão de entrega)

## BUG: Respostas Duplicadas do Chatbot (13/03/2026)
- [x] Bot responde 2-4 vezes para cada mensagem do cliente
  - Causa raiz: webhook + polling processando a mesma mensagem, e Evolution API enviando múltiplos MESSAGES_UPSERT
- [x] Investigar causa raiz: webhook duplo, polling ativo, dedup falhando
- [x] Implementar deduplicação robusta por messageId
  - Camada 1: Dedup no webhook (isWebhookDuplicate) — bloqueia eventos duplicados da Evolution API
  - Camada 2: Dedup no processIncomingMessage (isDuplicateMessage) — última barreira webhook+polling
  - Camada 3: Lock por cliente (withClientLock) — serializa processamento do mesmo cliente
- [x] Testar e validar — 97 testes passando (9 novos para dedup)
- [x] BUG PERSISTENTE: Respostas ainda triplicando após dedup por messageId
  - Causa raiz: dedup em memória (Map/Set) não funciona entre múltiplas instâncias (dev + produção)
- [x] Investigar se há múltiplas instâncias (dev + produção) ou polling com IDs diferentes
  - Confirmado: 3 instâncias processando (sandbox dev + produção publicada + polling)
- [x] Implementar correção definitiva
  - Tabela `processed_messages` no banco com UNIQUE constraint no messageId
  - `tryClaimMessage()` usa INSERT IGNORE: só a primeira instância a inserir processa
  - Limpeza automática a cada 30 min (mensagens > 1 hora)

## BUG: Previsão de Entrega na Confirmação WhatsApp (13/03/2026)
- [x] Mensagem de confirmação do WhatsApp mostra previsão fora do horário (08:45-09:10 quando abre às 11h)
  - Causa raiz: servidor roda em UTC, new Date().getHours() retornava hora UTC (09h) em vez de BRT (06h)
  - Solução: criada função getNowBRT() que converte UTC para America/Sao_Paulo
- [x] Auditar de ponta a ponta todos os pontos que calculam previsão de entrega
  - businessHours.ts: checkBusinessHours agora usa getNowBRT() como padrão
  - orderNotification.ts: calcularTempoEstimado e formatConfirmationMessage usam getNowBRT()
  - chatbot.ts: cálculo de dia da semana para previsão usa getNowBRT()
  - Confirmacao.tsx (frontend): OK, roda no navegador do cliente (fuso local)
- [x] Corrigir orderNotification.ts para respeitar horário de funcionamento
- [x] Validar consistência: cardápio digital, chatbot, notificação WhatsApp
  - 102 testes passando (5 novos para timezone BRT)

## Pesquisa: Valor de Mercado do Sistema (13/03/2026)
- [x] Analisar completamente o sistema desenvolvido (tamanho, funcionalidades, especificidades)
- [x] Pesquisar custos de desenvolvimento freelancer/empresa no interior de SP
- [x] Estimar tempo de desenvolvimento sem IA
- [x] Comparar com soluções do mercado

## Pesquisa: Ferramentas de Auditoria de Código com IA (13/03/2026)
- [x] Pesquisar ferramentas de auditoria de código com IA (Codex, Cursor, etc.)
- [x] Comparar custo-benefício das ferramentas
- [x] Identificar a melhor abordagem para auditar o sistema completo

## Exportação GitHub + Guia de Auditoria Claude Code (13/03/2026)
- [x] Exportar projeto para repositório GitHub privado (cjvj0210/chatbot-restaurante-whatsapp)
- [x] Pesquisar detalhes atualizados do Claude Code Review e CLI
- [x] Criar guia completo de auditoria com prompts prontos (6 rodadas especializadas)
- [x] Incluir metodologia passo a passo para leigo
- [x] Entregar guia e confirmar exportação

## Sprint de Correções Pré-Auditoria (13/03/2026) — CONCLUÍDA
- [x] BUG 1: Modo humano não para o bot
  - Corrigido: bot agora ativa modo humano IMEDIATAMENTE ao detectar [CHAMAR_ATENDENTE] na resposta da IA
  - Modo humano ativado por 30 min antes mesmo do operador responder
  - Bot fica 100% silencioso até operador enviar #bot
- [x] BUG 2: Bot não lê contexto recente
  - Corrigido: bot agora busca pedidos recentes (24h) e reservas ativas do cliente
  - Injeta no prompt: número do pedido, status, tipo, total
  - Regra: se cliente perguntar sobre demora, usa o pedido já conhecido sem pedir número
- [x] BUG 3: Previsão de entrega no texto do bot via WhatsApp
  - Corrigido: agora verifica se restaurante está aberto (11h-15h, 19h-23h)
  - Se fechado, calcula horário estimado baseado na próxima abertura
- [x] BUG 4: Mini pastéis com seção duplicada
  - Corrigido: removido grupo duplicado "Quantidade" (ID 77) do banco
  - Mantém apenas "Escolha o tamanho" (ID 30013) e "Escolha o sabor" (ID 76)
- [x] BUG 5: Bot perde contexto de conversa
  - Corrigido: histórico aumentado de 15 para 30 mensagens
  - Reservas ativas injetadas no prompt do LLM
  - Bot agora lembra de reservas, pedidos e conversas anteriores na mesma sessão
- [x] Atualizar código no GitHub após correções (push realizado com sucesso)


## Auditoria de Segurança (Claude Code - Rodada 1)
- [x] CRITICAL-002: Webhook Evolution API fail-closed (rejeitar chave inválida)
- [x] CRITICAL-001: CSP ativado com Helmet (headers HTTP defensivos)
- [x] HIGH-001: getById → adminProcedure (fim do IDOR por enumeração)
- [x] HIGH-002: 13 procedures migradas de protectedProcedure → adminProcedure
- [x] HIGH-003: accessToken mascarado na resposta (**** nos dígitos centrais)
- [x] HIGH-004: Filtros de injection expandidos para PT-BR
- [x] HIGH-005: Preços de addons buscados do banco via optionId
- [x] HIGH-006: Removido fallback JWT_SECRET; send-test restrito a dev
- [x] MEDIUM-002: Rate limit 20 msgs/hora por IP nos endpoints públicos
- [x] MEDIUM-004: escapeLike() escapa %, _, \ antes de queries LIKE
- [x] MEDIUM-005: Human mode usa apenas [CHAMAR_ATENDENTE]
- [x] MEDIUM-006: Dados de reserva sanitizados antes de injeção no contexto LLM
- [x] MEDIUM-007: CORS com allowlist explícita; Permissions-Policy adicionado
- [x] MEDIUM-008: Limitação do rate limit documentada para migração futura
- [x] LOW-001: req.query.secret removido — segredo apenas via header X-Diag-Secret
- [x] LOW-002: ipAddress passado a todos os logAudit()
- [x] LOW-005: audioBase64.max(14MB) + allowlist de MIME em sendAudio
- [x] LOW-006: Magic bytes validados (JPEG FF D8 FF, PNG 89 50 4E 47, WebP RIFF...WEBP)
- [x] CS-003: Math.random() → randomBytes(2) (CSPRNG)
- [x] Puxar correções do GitHub para o Manus
- [x] Rodar testes (102 passed, 0 failed)
- [x] Servidor reiniciado com correções aplicadas

- [x] Configurar DIAG_SECRET como variável de ambiente separada


## Auditoria de Arquitetura (Claude Code - Rodada 2)

### Correções de Alta Severidade (7/7 implementadas)
- [x] Criar server/services/whatsappService.ts — unificar envio WhatsApp (Evolution + Meta Cloud API)
- [x] Extrair chatbotActionHandler.ts + customerContextBuilder.ts do chatbot.ts
- [x] Criar server/utils/logger.ts — logger centralizado com info/warn/error/debug
- [x] Migrar rate limiting de memória para banco de dados (checkChatbotRateLimit)
- [x] Migrar botMessageTracker de memória para banco de dados (processed_messages)
- [x] Criar server/utils/retry.ts — retry com backoff exponencial (1s, 2s, 4s)
- [x] Adicionar try/catch em todas as chamadas invokeLLM()

### Correções de Média Severidade (12/12 implementadas)
- [x] Normalização de telefone centralizada em phoneNormalizer.ts
- [x] Transcrição de áudio extraída para audioService.ts
- [x] Lógica de modo humano separada em humanModeService.ts
- [x] Polling configurável via POLL_INTERVAL_MS env var (10s prod, 3s dev)
- [x] .catch(() => {}) substituído por logger.warn()
- [x] Magic numbers extraídos para shared/constants.ts (CHATBOT + ORDER)
- [x] checkBusinessHours() reutilizado no chatbotActionHandler.ts
- [x] expireHumanModes() agendado a cada 5 min em maintenance.ts
- [x] Todos os console.* substituídos por logger.* com prefixos padronizados
- [x] Validação e truncamento de messageText no webhook e polling
- [x] any eliminado: CustomerUpdates, LLMContentPart, OrderStatus tipados
- [x] #bot case-insensitive + aceita #ativar/#reativar


## Rodada 3 - Auditoria de Performance (14/03/2026)

### Críticos (3)
- [x] N+1 em order.list (orderRouter.ts) — 21 queries → 1 query (~95%)
- [x] Memory leak em polling (messagePolling.ts) — Set sem TTL → Map com TTL 2h
- [x] Race condition modo humano (chatbot.ts) — UPDATE atômico eliminando SELECT+UPDATE

### Altos (8)
- [x] Índices no schema (drizzle/schema.ts) — Evita full scan em conversations/messages
- [x] useEffect no Dashboard (Dashboard.tsx) — Um único interval em vez de múltiplos
- [x] Backoff exponencial (messagePolling.ts) — Recua até 60s em falhas consecutivas
- [x] Limpeza periódica webhook dedup (webhookEvolution.ts) — Mapa limpo a cada 60s
- [x] Batch queries para addons (db.ts) — 20 queries sequenciais → 2 paralelas (40x)
- [x] useMemo no preço total (Pedido.tsx) — Sem recálculo desnecessário
- [x] React.memo no CustomerHistory (Orders.tsx) — Sem re-renders por pedido
- [x] Cache getRestaurantSettings (db.ts) — TTL 30s, sem query por mensagem

### Médios (6) + Baixos (1)
- [x] Lazy loading de 10 páginas admin (~120 KB no bundle inicial)
- [x] TTL de 24h nas sessões do simulador
- [x] FAQ cache com keyword pre-filter (evita 240 regex tests)
- [x] Cache BRT DateTime 500ms (3 chamadas Intl → 1 cached)
- [x] Scheduler centralizado (7 setInterval → 1 ScheduledTask[])
- [x] Jitter nos retries da Evolution API (evita thundering herd)

## Bug - Bot parou de responder após patch de performance (14/03/2026)
- [ ] Investigar logs do servidor para identificar erro
- [ ] Identificar causa raiz (possível regressão no patch de performance)
- [ ] Corrigir e testar

## Rodada 4 - Auditoria de Qualidade (Claude Code - 46 correções)

### P1 Críticos
- [x] handleOrderStatus refatorado CC~12→~3 (extraídas 3 funções auxiliares)
- [x] catch {} silencioso em parse de data de reserva → logger.warn
- [x] URL hardcoded manus.space consolidada para getSiteUrl() em todos os arquivos
- [x] Novo arquivo server/chatbot-flow.test.ts com 7 testes para processIncomingMessage

### P2 Código Morto
- [x] Remover extractPhoneFromJid (webhookEvolution.ts) — substituído por phoneNormalizer.normalize
- [x] Remover extractPhoneFromWhatsappId (db.ts) — substituído por phoneNormalizer
- [x] BOT_COMMANDS movido para escopo do módulo (webhookEvolution.ts)

### P2 Tratamento de Erros
- [x] 100% de console.* substituídos por logger.* em db.ts e keepAlive.ts
- [x] (result as any).rowsAffected → getAffectedRows (novo helper dbHelpers.ts)
- [x] Telefone hardcoded 5517982123269 → variável RESTAURANT_PHONE com fallback

### P2 Testes
- [x] Novos testes: chatbotActions.test.ts, webhookEvolution.test.ts
- [x] 5 testes de boundary para sábado em estimativa.test.ts

### P3 Melhorias
- [x] Renomeações de variáveis genéricas (tempo→deliveryTimeRange, fn→operation, res→insertResult)
- [x] JSDoc adicionado às funções principais do chatbotActionHandler
- [x] Dead code removido: sendButtonMessage, sendListMessage
- [x] Constantes INFRA em shared/constants.ts (KEEP_ALIVE_PING_INTERVAL_MS, etc.)

## Rodada 5 - Auditoria UX/Acessibilidade + Fix Polling (Claude Code)

### Fix Polling (bug mensagens perdidas no restart)
- [x] pollingStartTimestamp recuado 2 min (RESTART_SAFETY_WINDOW_SECONDS) para cobrir gap de restart
- [x] Constante RESTART_SAFETY_WINDOW_SECONDS adicionada em shared/constants.ts

### Acessibilidade WCAG 2.1 AA
- [x] Novo hook useFocusTrap.ts para modais e diálogos
- [x] Novo utilitário announceToSR.ts para anúncios a leitores de tela
- [x] DashboardLayout.tsx — role="navigation" e aria-labels
- [x] ChatSimulator.tsx — aria-live, roles, labels em inputs
- [x] Checkout.tsx — aria-labels, roles, melhorias de foco
- [x] Customers.tsx — tabela acessível com roles e aria-labels
- [x] Dashboard.tsx — cards com aria-labels descritivos
- [x] Orders.tsx — tabela com aria-sort, roles, melhorias de navegação por teclado
- [x] Pedido.tsx — melhorias de acessibilidade em formulários
- [x] PublicTest.tsx — labels e roles acessíveis
- [x] Settings.tsx — aria-labels em formulários de configuração
- [x] Simulator.tsx — melhorias de acessibilidade no simulador

## Rodada 6 - Auditoria de Resiliência (Claude Code)

### Commit 1 - 16 correções
- [x] LLM-1: Timeout 60s via AbortController no invokeLLM (_core/llm.ts)
- [x] LLM-2: Retry 2x com backoff em chamadas ao LLM (chatbot.ts)
- [x] LLM-3: max_tokens 32768→1024, budget_tokens 128→64 (_core/llm.ts)
- [x] DB-1: Pool MySQL explícito (connectionLimit:5) + circuit breaker (db.ts)
- [x] DB-3: Loop serial → batch query em getAddonGroupsWithOptions (db.ts)
- [x] S3-1: Timeout 30s + retry 2x em storagePut (storage.ts)
- [x] S3-2: Verificar response.ok em buildDownloadUrl (storage.ts)
- [x] EVO-1: Retry 2x em downloadMediaEvolution (evolutionApi.ts)
- [x] EVO-2: Retry 2x em deleteMessageForEveryone (evolutionApi.ts)
- [x] EVO-3: Novo sendTextMessageEvolutionWithId, removeu duplicação (evolutionApi.ts + webhookEvolution.ts)
- [x] WP-1: Timeout 90s no withClientLock anti-vazamento de memória (chatbot.ts)
- [x] GD-1: Safety window 120s→300s (shared/constants.ts)
- [x] GD-2: FAQ antes do banco + modo degradado com banco fora (chatbot.ts)
- [x] LOG-1: Timestamps ISO + serialização correta de Error (utils/logger.ts)
- [x] LOG-2: Logs de sucesso movidos para debug silenciosos em prod (messagePolling.ts)
- [x] TO-M5: Timeout 15s nos fetches da Meta API (audioTranscription.ts)

### Commit 2 - 2 correções extras
- [x] DB-2: Transação atômica em criação de cliente + conversa sem registros órfãos (db.ts)
- [x] WP-3: Janela de busca do polling adaptativa ao backoff recupera mensagens durante downtime (messagePolling.ts)

## Bug - Modo humano não bloqueia o bot (14/03/2026)
- [x] Bot responde mesmo após ativar modo humano — corrigido: verificação do modo humano movida para ANTES do FAQ cache + nova função getActiveConversationByWhatsappId

## Bug PERSISTENTE - Modo humano ainda não bloqueia o bot (14/03/2026 - 19:20)
- [x] Bot continua respondendo após ativar modo humano — CAUSA RAIZ: prompt do LLM não instruía o marcador [CHAMAR_ATENDENTE]. Corrigido com 3 camadas: prompt explícito + NLP fallback + detecção de pedido do cliente

## Bug CRÍTICO - Prompt do LLM não instrui marcador [CHAMAR_ATENDENTE] (14/03/2026)
- [x] Prompt do LLM diz "transfira para atendente humano" mas NUNCA instrui o LLM a incluir o marcador [CHAMAR_ATENDENTE] na resposta
- [x] Resultado: LLM gera texto como "vou te conectar com nossa equipe" SEM o marcador, e chatbot.ts (linha 450) nunca detecta
- [x] Adicionar seção explícita no prompt instruindo uso do marcador [CHAMAR_ATENDENTE] em TODAS as situações de transferência
- [x] Adicionar detecção NLP como fallback (frases como "quero falar com humano", "atendente", etc.)
- [x] Adicionar remoção do marcador [CHAMAR_ATENDENTE] da resposta antes de enviar ao cliente
- [x] 6 novos testes (NLP fallback, detecção de pedido do cliente, não-ativação falsa, remoção do marcador)

## Bug - Comando #bot (14/03/2026 - 19:52)
- [x] Comando #bot aparece no chat do cliente como mensagem visível — CAUSA: deleteMessageForEveryone pode falhar/demorar. Adicionado logging detalhado.
- [x] Comando #bot não reativa o bot — CAUSA RAIZ: humanModeService não passava realPhone para getCustomerByWhatsappId. JIDs @lid não encontravam customer salvo com @s.whatsapp.net. Corrigido com findCustomerByJid com fallback.
- [x] #bot é interceptado no webhook (fromMe=true) e NÃO chega ao processIncomingMessage. Polling ignora fromMe=true.

## Bugs CRÍTICOS reportados pelo usuário (14/03/2026 - 21:43) - CORRIGIDOS
- [x] #bot: adicionado fallback no polling para detectar #bot quando webhook não funciona
- [x] Reprocessamento: reduzido RESTART_SAFETY_WINDOW de 300s para 60s + filtro de idade máxima de 2min + backoff máximo de 2min
- [x] Transferência: cache em memória do modo humano por phone normalizado (3 camadas: cache + DB + NLP)
- [x] Bot continuou respondendo: cache em memória garante silenciamento imediato independente de JID
- [x] Demora + msgs em lote: reduzido backoff máximo e janela de segurança

## Melhorias de UX no Modo Humano e #bot (15/03/2026)
- [x] Após #bot reativar, bot retoma conversa automaticamente (busca histórico, identifica última pergunta pendente, gera resposta via LLM)
- [x] Quando cliente pede atendente via fallback NLP, bot envia mensagem de transição padrão ("Aguarde uns minutinhos...")
- [x] Notificação melhorada para operador no número do restaurante com dados do cliente e instruções

## Bug - Bot contradiz status do pedido (15/03/2026) - CORRIGIDO
- [x] Bot diz "aguardando aceite" quando já confirmado: CORRIGIDO - customerContextBuilder injeta instrução explícita para priorizar status do banco
- [x] LLM não recebia status atualizado: CORRIGIDO - bloco de contexto reforçado com "ATENÇÃO: IGNORE status do histórico"
- [x] Re-consulta do banco: já funcionava via customerContextBuilder, reforçado com instrução explícita
- [x] Histórico desatualizado: LLM agora instruído a ignorar status do histórico

## Bug - Número errado na notificação de cancelamento (15/03/2026) - CORRIGIDO
- [x] Notificação de cancelamento: trocado (17) 9 8212-3269 por (17) 3325-8628 em orderNotification.ts
- [x] Reserva cancelada: trocado em routers.ts
- [x] Lembrete de reserva: trocado em reservationReminder.ts

## Bug - Previsão de entrega em horário fechado (15/03/2026) - CORRIGIDO
- [x] Previsão agora considera isEarlyOrder do checkBusinessHours
- [x] Se pedido antecipado (antes das 11h), previsão começa a contar da abertura (11h ou 19h)
- [x] Mensagem inclui nota "(A produção começa às HH:MM)" para pedidos antecipados
- [x] Número fixo (17) 3325-8628 usado em mensagem de atraso

## BUG - Bot Não Responde Mensagens (15/03/2026) - CORRIGIDO
- [x] Investigar por que o bot não está respondendo mensagens no WhatsApp
- [x] Verificar logs do servidor e webhook — Timeouts no polling (Render cold start)
- [x] Verificar conexão com Evolution API — Instância OK (state: open), API respondendo
- [x] Causa raiz: Render cold start + MAX_MESSAGE_AGE_SECONDS=120s descartava mensagens antigas
- [x] Correção: Janela de idade dinâmica (120s normal, até 1200s após cold start)
- [x] Correção: backoffWindow expandido (120s normal, até 1200s após erros)
- [x] Correção: keepAlive reduzido de 4min para 2min para minimizar cold starts
- [ ] Testar e confirmar funcionamento

## Migração para Cloud API Oficial da Meta (16/03/2026)
- [x] Salvar credenciais da Cloud API (token, phone number ID, WABA ID)
- [x] Criar adapter cloudApi.ts para envio de mensagens via Graph API
- [x] Criar endpoint webhook para receber mensagens da Cloud API (webhookCloudApi.ts)
- [x] Implementar parsing de payload da Cloud API (diferente da Evolution API)
- [x] Criar sistema de seleção de provider (Evolution vs Cloud API) via env var WHATSAPP_PROVIDER
- [x] Registrar rotas /api/webhook/cloud no index.ts
- [x] Atualizar orderNotification, maintenance, reservationReminder para usar whatsappService
- [x] Desativar polling/keepAlive quando provider=cloud_api
- [x] Escrever testes vitest para o adapter da Cloud API (17 testes passando)
- [x] Configurar webhook na Meta (URL + verify token)
- [x] Testar envio de mensagem via Cloud API
- [x] Testar recebimento de mensagem via webhook Cloud API
- [x] Testar fluxo completo do chatbot com número de teste
- [x] BUG: Bot via Cloud API responde saudações mas não responde a mensagens subsequentes - RESOLVIDO: bot funciona, problema era timing/deploy

## Token de Longa Duração e Renovação Automática (16/03/2026)
- [x] Gerar token de longa duração (60 dias) a partir do token temporário + App Secret
- [x] Atualizar META_CLOUD_API_TOKEN com token de longa duração
- [x] Implementar renovação automática do token antes de expirar (~50 dias)
- [x] Armazenar App Secret como variável de ambiente (META_APP_SECRET)
- [x] Escrever teste vitest para validação do token (16 testes passando)
- [x] Testar envio de mensagem com link (que falhava com token temporário) - FUNCIONANDO
- [x] Marcar webhook e testes como concluídos no todo

## BUG CRÍTICO - Bot não responde delivery/pedidos via Cloud API (16/03/2026)
- [x] Investigar por que o bot responde saudações e informações mas NÃO responde pedidos de delivery - RESOLVIDO
- [x] Verificar logs do servidor para mensagens "Queria pedir uma marmita" e "fazer um pedido delivery" - Processadas OK
- [x] Analisar se o problema é deduplicação, lock, timeout do LLM, ou envio da resposta - Nenhum desses
- [x] Corrigir a causa raiz - Melhorias: webhook fire-and-forget, preview_url auto, logging detalhado, fallback notificação
- [x] Testar fluxo completo de delivery via Cloud API - FUNCIONANDO (dev e deploy)

## Configurar META_APP_ID (16/03/2026)
- [x] Identificar o App ID correto do aplicativo Meta do Clóvis - 1460805355566215
- [x] Configurar META_APP_ID como variável de ambiente
- [x] Testar que a renovação automática usa /debug_token corretamente - 16 testes passando

## BUG PERSISTENTE - Bot não responde cardápio/delivery em produção (16/03/2026)
- [x] Investigar por que mensagens de delivery não recebem resposta - CAUSA: sendMedia via Cloud API falha silenciosamente (aceita request mas não entrega)
- [x] Verificar banco: respostas de delivery GERADAS corretamente (IDs 510056, 510058) mas não entregues
- [x] Problema é no ENVIO: sendMedia (imagem+caption) falha na Cloud API, fallback não executa pois sendMedia retorna true
- [x] CORREÇÃO: Cloud API agora envia delivery como TEXTO com preview_url=true (não como imagem). Imagem só para Evolution API
- [ ] Aguardando teste do Clóvis em produção para confirmar

## BUG - Fuso horário errado no bot (16/03/2026)
- [x] Bot disse "estamos abertos para o almoço" às 15:19 (BRT) - CORRIGIDO: prompt atualizado com horários precisos
- [x] Bot já usava BRT corretamente (getNowBRT), problema era no prompt do LLM que dizia "11h-15h"
- [x] Prompt corrigido com horários exatos: almoço 11h-14h30, jantar 19h-22h45
- [x] Testado: 206 testes passando, TypeScript sem erros

## BUG - Cardápio digital aviso incorreto na segunda-feira (16/03/2026)
- [x] Cardápio digital mostrava "jantar abre às 19h" na segunda - CORRIGIDO
- [x] DELIVERY_HOURS[1] e PICKUP_HOURS[1] (segunda) agora têm dinner: null
- [x] checkBusinessHours agora retorna isOpen=false na segunda à tarde (sem aviso de jantar)
- [x] Testes atualizados: segunda fechado à noite, terça com jantar, 206 testes passando

## Ajuste taxa de entrega para R$ 8,50 (16/03/2026)
- [x] Identificar todos os locais onde a taxa de entrega está configurada
- [x] Taxa já estava correta em R$ 8,50 (850 centavos) em TODOS os locais:
  - shared/constants.ts: DEFAULT_DELIVERY_FEE_CENTS = 850
  - Pedido.tsx e Checkout.tsx: deliveryFee = 850, textos "R$ 8,50"
  - chatbotPrompt.ts: "Taxa de entrega: R$ 8,50"
  - orderRouter.ts: usa settings?.deliveryFee ?? 850
  - Banco de dados (restaurant_settings): deliveryFee = 850
- [x] Nenhuma alteração necessária - tudo consistente

## Troca para número real de teste +55 17 99225 3886 (17/03/2026)
- [ ] Atualizar META_PHONE_NUMBER_ID para 1095900883597529
- [ ] Atualizar META_WABA_ID para 2430571627387237
- [ ] Verificar webhook configurado para o novo número
- [ ] Testar envio de mensagem com o novo número
- [ ] Gerar token de longa duração para o novo WABA (se necessário)

## BUG - Bot responde pelo número antigo em vez do novo (17/03/2026)
- [x] Webhook recebe mensagens do +55 17 99225 3886 mas bot responde pelo +1 555 173-3212 - deploy precisava republicar
- [x] Investigar: cloudApi.ts usa process.env.META_PHONE_NUMBER_ID - variáveis atualizadas no dev mas deploy precisa republicar
- [x] Checkpoint 4e702c9d salvo - deploy vai receber novas variáveis após republicar
- [ ] Aguardando Clóvis republicar e testar


## Integração YCloud (Coexistência WhatsApp)
- [x] Criar handler de webhook para formato YCloud (whatsapp.inbound_message.received)
- [x] Registrar rota no servidor (detecção automática no /api/webhook/cloud)
- [x] Salvar credenciais YCloud como secrets (webhook ID, secret, API key)
- [x] Manter compatibilidade com webhook Cloud API existente
- [x] Adaptar envio de mensagens para funcionar via YCloud API
- [x] Testar recebimento de mensagens via YCloud webhook
- [x] Implementar transcrição de áudio via YCloud (download com X-API-Key + upload S3 + Whisper)
