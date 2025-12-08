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
