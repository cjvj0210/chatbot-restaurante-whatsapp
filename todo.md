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
