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


## Customização Churrascaria Estrela do Sul
- [x] Configurar informações reais do restaurante no banco de dados
- [ ] Criar cardápio completo de delivery (marmitex, pratos executivos, kits) - AGUARDANDO USUÁRIO
- [x] Configurar valores do rodízio
- [ ] Implementar lógica de horários de funcionamento específicos
- [ ] Configurar taxas de entrega e pedido mínimo
- [ ] Implementar cálculo de tempo de entrega por dia/período
- [ ] Customizar tom de voz (formal, empático, humanista)
- [ ] Adicionar tratamento de observações especiais nos pedidos
- [ ] Implementar sistema de transferência para atendente humano
- [ ] Criar FAQ com dúvidas comuns
- [ ] Implementar coleta de feedback periódica

## Simulador de Conversa para Testes
- [x] Criar interface de chat simulado no painel admin
- [x] Implementar fluxo de pedido de delivery completo
- [x] Implementar fluxo de reserva completo
- [x] Implementar fluxo de informações gerais
- [x] Testar observações especiais em pedidos
- [x] Testar transferência para atendente humano

## Integrações com Sistemas Existentes
- [ ] Pesquisar API do Colibri POS
- [ ] Implementar integração com Colibri (ou exportação manual)
- [ ] Pesquisar API do Get-In (reservas)
- [ ] Implementar integração com Get-In (ou exportação manual)
- [ ] Sistema de notificação para equipe quando houver novo pedido

## Identidade Visual
- [x] Aplicar cores da logo (vermelho, preto, branco) no painel
- [x] Adicionar logo da Churrascaria no painel
- [x] Customizar tema do painel administrativo
