# Chatbot WhatsApp para Restaurante 🍽️

Sistema completo de chatbot inteligente para WhatsApp Business, desenvolvido especificamente para restaurantes. Automatiza atendimento, pedidos, reservas e feedback dos clientes usando IA conversacional.

## 🚀 Funcionalidades

### Backend
- ✅ **Integração WhatsApp Cloud API**: Conexão direta com a API oficial da Meta
- ✅ **IA Conversacional**: Processamento de linguagem natural com GPT-4/Gemini
- ✅ **Webhook**: Recebimento de mensagens em tempo real
- ✅ **Detecção de Intenção**: Identifica automaticamente pedidos, reservas, informações e feedback
- ✅ **Gerenciamento de Contexto**: Mantém histórico de conversas
- ✅ **Mensagens Interativas**: Botões e listas para melhor experiência do usuário

### Painel Administrativo
- ✅ **Dashboard**: Estatísticas em tempo real (pedidos, receita, reservas, clientes)
- ✅ **Gerenciamento de Cardápio**: CRUD completo de categorias e itens
- ✅ **Gestão de Pedidos**: Visualização e atualização de status
- ✅ **Gestão de Reservas**: Controle de reservas de mesa
- ✅ **Configurações**: Restaurante e WhatsApp Business API
- ✅ **Autenticação**: Sistema de login seguro

### Banco de Dados
- ✅ Configurações do restaurante
- ✅ Cardápio (categorias e itens)
- ✅ Pedidos e reservas
- ✅ Clientes e histórico
- ✅ Conversas e mensagens
- ✅ Feedback dos clientes

## 🛠️ Stack Tecnológico

### Frontend
- React 19
- TypeScript
- TailwindCSS 4
- shadcn/ui
- tRPC (type-safe API)
- Wouter (routing)

### Backend
- Node.js
- Express
- tRPC
- Drizzle ORM
- MySQL/TiDB

### Integrações
- WhatsApp Cloud API (Meta)
- OpenAI GPT-4 / Google Gemini
- S3 Storage

## 📋 Pré-requisitos

1. **Conta Meta for Developers**
   - Criar aplicativo WhatsApp Business
   - Obter Phone Number ID
   - Gerar Access Token permanente
   - Configurar Webhook

2. **Banco de Dados MySQL**
   - Fornecido automaticamente pelo ambiente Manus

3. **Credenciais de IA**
   - Fornecidas automaticamente pelo ambiente Manus

## 🔧 Configuração

### 1. Configurar Restaurante

Acesse **Configurações > Restaurante** no painel admin e preencha:
- Nome do restaurante
- Telefone e endereço
- Horário de funcionamento
- Formas de pagamento
- Taxa de entrega e pedido mínimo
- Aceita delivery/reservas

### 2. Configurar WhatsApp Business API

Acesse **Configurações > WhatsApp Business** e preencha:

```
Phone Number ID: [obtido no Meta for Developers]
Access Token: [token permanente da Meta]
Webhook Verify Token: [token que você define]
```

**URL do Webhook:**
```
https://seu-dominio.manus.space/api/webhook/whatsapp
```

**Configuração no Meta for Developers:**
1. Acesse https://developers.facebook.com/
2. Selecione seu aplicativo WhatsApp Business
3. Vá em **WhatsApp > Configuration**
4. Configure o Webhook:
   - URL: `https://seu-dominio.manus.space/api/webhook/whatsapp`
   - Verify Token: [o mesmo que você definiu nas configurações]
   - Subscribe to: `messages`

### 3. Criar Cardápio

1. Acesse **Cardápio** no painel
2. Crie categorias (ex: Pizzas, Bebidas, Sobremesas)
3. Adicione itens em cada categoria com:
   - Nome
   - Descrição
   - Preço
   - Tempo de preparo

### 4. Ativar Chatbot

Nas **Configurações > WhatsApp Business**, ative o switch **Chatbot Ativo**.

## 💬 Fluxos de Conversa

### Pedido de Delivery

```
Cliente: "Quero fazer um pedido"
Bot: "Ótimo! Vou te mostrar nosso cardápio 📋"
     [Mostra lista interativa com categorias e itens]
Cliente: [Seleciona itens]
Bot: "Perfeito! Qual o endereço de entrega?"
Cliente: "Rua X, 123"
Bot: "Pedido confirmado! Total: R$ XX,XX. Tempo estimado: 40min"
```

### Reserva de Mesa

```
Cliente: "Quero fazer uma reserva"
Bot: "Claro! Para quantas pessoas?"
Cliente: "4 pessoas"
Bot: "Para qual dia e horário?"
Cliente: "Sábado às 20h"
Bot: "Verificando... ✅ Temos mesa disponível! Qual seu nome?"
Cliente: "João Silva"
Bot: "Reserva confirmada para 4 pessoas, sábado 20h!"
```

### Informações Gerais

```
Cliente: "Qual o horário de funcionamento?"
Bot: "Estamos abertos de segunda a sábado, das 11h às 23h! 🕐"

Cliente: "Vocês aceitam cartão?"
Bot: "Sim! Aceitamos cartões de débito, crédito, Pix e dinheiro 💳"
```

## 📊 Gerenciamento de Pedidos

No painel **Pedidos**, você pode:
- Ver todos os pedidos em tempo real
- Atualizar status: Pendente → Confirmado → Preparando → Pronto → Em Entrega → Entregue
- Ver detalhes: itens, endereço, observações, total
- Filtrar por status

## 📅 Gerenciamento de Reservas

No painel **Reservas**, você pode:
- Ver todas as reservas
- Atualizar status: Pendente → Confirmada → Concluída/Cancelada
- Ver detalhes: data, horário, número de pessoas, observações

## 💰 Modelo de Custos

### WhatsApp Cloud API (Meta)

| Categoria | Preço/Mensagem (BRL) | Quando é Cobrado |
|-----------|---------------------|------------------|
| **Serviço** | R$ 0,00 | Nunca (sempre grátis) |
| **Utilidade** | R$ 0,044 | Fora da janela de 24h |
| **Marketing** | R$ 0,344 | Sempre |

**Benefícios:**
- 1.000 conversas de serviço gratuitas/mês
- Respostas a clientes (categoria Serviço) são sempre gratuitas
- Confirmações dentro de 24h são gratuitas

**Estimativa para Restaurante Médio (500 atendimentos/mês):**
- Mensagens de Serviço: R$ 0,00
- Mensagens de Utilidade: ~R$ 13,20
- Mensagens de Marketing: ~R$ 34,40
- **Total: ~R$ 47,60/mês** (apenas WhatsApp API)

## 🧪 Testes

O projeto inclui testes automatizados para:
- Dashboard e estatísticas
- Configurações do restaurante
- Gerenciamento de cardápio
- Pedidos e reservas
- Clientes e feedback

Execute os testes:
```bash
pnpm test
```

## 📱 Exemplo de Uso

1. Cliente envia mensagem no WhatsApp Business do restaurante
2. Chatbot recebe via webhook e processa com IA
3. Sistema detecta intenção (pedido, reserva, info)
4. Bot responde de forma inteligente e contextual
5. Dados são salvos no banco de dados
6. Restaurante visualiza e gerencia no painel admin
7. Status é atualizado e cliente é notificado

## 🔒 Segurança

- Autenticação OAuth via Manus
- Tokens de acesso armazenados de forma segura
- Validação de webhook do WhatsApp
- Proteção de rotas administrativas
- Dados criptografados em trânsito

## 📈 Próximas Funcionalidades

- [ ] Histórico de conversas no painel
- [ ] Página de clientes com histórico
- [ ] Notificações em tempo real
- [ ] Integração com sistemas de PDV
- [ ] Relatórios e analytics avançados
- [ ] Suporte a múltiplos idiomas
- [ ] Processamento de imagens (cliente envia foto)
- [ ] Transcrição de áudios

## 🤝 Suporte

Para dúvidas sobre:
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
- **Plataforma Manus**: https://help.manus.im

## 📄 Licença

MIT

---

**Desenvolvido com ❤️ para otimizar o atendimento de restaurantes via WhatsApp**
