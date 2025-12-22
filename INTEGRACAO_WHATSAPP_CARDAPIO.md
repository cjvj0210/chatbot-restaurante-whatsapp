# Integração WhatsApp + Cardápio Digital

## Objetivo
Criar fluxo onde bot do WhatsApp redireciona cliente para cardápio web e recebe pedido finalizado de volta.

---

## ARQUITETURA PROPOSTA

### Fluxo Completo:

```
1. Cliente: "Quero fazer um pedido"
   ↓
2. Bot detecta intenção de pedido
   ↓
3. Bot gera link único: 
   https://estreladosul.com/pedido/{sessionId}
   ↓
4. Bot envia mensagem:
   "Ótimo! Clique no link abaixo para ver nosso cardápio completo:
   [Link do Cardápio] 🍖📱"
   ↓
5. Cliente clica e abre cardápio web
   ↓
6. Cliente navega, adiciona itens ao carrinho
   ↓
7. Cliente finaliza pedido (nome, endereço, pagamento)
   ↓
8. Sistema salva pedido no banco
   ↓
9. Sistema envia webhook para WhatsApp
   ↓
10. Bot recebe notificação e envia mensagem formatada:
    "✅ Pedido #123 recebido!
    
    📦 Itens:
    - 1x Marmitex Grande (R$ 34,00)
    - 1x Refrigerante (R$ 5,00)
    
    💰 Total: R$ 39,00
    📍 Entrega: Rua X, 123
    ⏰ Previsão: 40-50 minutos
    
    Seu pedido já está sendo preparado! 🔥"
   ↓
11. Restaurante recebe pedido formatado para impressão
```

---

## COMPONENTES NECESSÁRIOS

### 1. Detecção de Pedido no Bot

**Arquivo**: `server/chatbotPrompt.ts`

Adicionar ao prompt:
```
## PEDIDOS DELIVERY

Quando o cliente manifestar interesse em fazer um pedido de delivery ou retirada:

1. NÃO tente coletar o pedido via chat
2. Envie esta mensagem EXATA:

"Ótimo! Para fazer seu pedido, clique no link abaixo e veja nosso cardápio completo com fotos e preços: 🍖

[LINK_CARDAPIO]

Lá você pode montar seu pedido com calma e finalizar tudo de forma rápida e segura! 📱✨"

3. Substitua [LINK_CARDAPIO] pela URL gerada pelo sistema
4. NÃO continue a conversa sobre pedidos após enviar o link
5. Se o cliente perguntar algo sobre o pedido após clicar, oriente a finalizar no cardápio web
```

### 2. Geração de Link Único

**Arquivo**: `server/routers.ts` (novo endpoint)

```typescript
export const orderLinkRouter = router({
  generateOrderLink: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      whatsappNumber: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { sessionId, whatsappNumber } = input;
      
      // Salvar sessão de pedido
      const db = await getDb();
      await db.insert(orderSessions).values({
        sessionId,
        whatsappNumber,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      });
      
      // Gerar link
      const orderLink = `${process.env.FRONTEND_URL}/pedido/${sessionId}`;
      
      return {
        orderLink,
        sessionId,
      };
    }),
});
```

### 3. Página do Cardápio Web

**Arquivo**: `client/src/pages/OrderPage.tsx` (NOVO)

Baseado no MERN Food Ordering System:
- Layout tipo iFood
- Categorias com fotos
- Carrinho flutuante
- Checkout simplificado

**Features**:
- ✅ Busca de itens
- ✅ Filtros por categoria
- ✅ Adicionais e personalizações
- ✅ Observações por item
- ✅ Cálculo automático de total
- ✅ Validação de pedido mínimo
- ✅ Taxa de entrega
- ✅ Escolha: Entrega ou Retirada

### 4. Finalização do Pedido

**Arquivo**: `server/routers.ts` (novo endpoint)

```typescript
export const orderRouter = router({
  createOrder: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      customerName: z.string(),
      customerPhone: z.string(),
      deliveryAddress: z.string().optional(),
      deliveryType: z.enum(['delivery', 'pickup']),
      items: z.array(z.object({
        menuItemId: z.number(),
        quantity: z.number(),
        observations: z.string().optional(),
        addons: z.array(z.string()).optional(),
      })),
      paymentMethod: z.enum(['pix', 'card', 'cash']),
      total: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      // Salvar pedido
      const [order] = await db.insert(orders).values({
        sessionId: input.sessionId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress,
        deliveryType: input.deliveryType,
        paymentMethod: input.paymentMethod,
        total: input.total,
        status: 'pending',
      }).returning();
      
      // Salvar itens do pedido
      for (const item of input.items) {
        await db.insert(orderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          observations: item.observations,
          addons: JSON.stringify(item.addons),
        });
      }
      
      // Enviar notificação para WhatsApp (webhook)
      await notifyWhatsAppBot(order.id, input.sessionId);
      
      return {
        orderId: order.id,
        status: 'confirmed',
      };
    }),
});
```

### 5. Notificação de Volta para WhatsApp

**Arquivo**: `server/whatsappNotification.ts` (NOVO)

```typescript
export async function notifyWhatsAppBot(orderId: number, sessionId: string) {
  const db = await getDb();
  
  // Buscar pedido completo
  const order = await db.select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  
  if (!order.length) return;
  
  // Buscar itens do pedido
  const items = await db.select()
    .from(orderItems)
    .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(eq(orderItems.orderId, orderId));
  
  // Formatar mensagem para WhatsApp
  const message = formatOrderForWhatsApp(order[0], items);
  
  // Enviar para fila de mensagens do bot
  await db.insert(botMessages).values({
    sessionId,
    message,
    type: 'order_confirmation',
    status: 'pending',
  });
  
  return message;
}

function formatOrderForWhatsApp(order: Order, items: OrderItem[]) {
  let message = `✅ *Pedido #${order.id} Confirmado!*\n\n`;
  message += `📦 *Itens:*\n`;
  
  for (const item of items) {
    message += `• ${item.quantity}x ${item.name} - R$ ${item.price.toFixed(2)}\n`;
    if (item.observations) {
      message += `  _Obs: ${item.observations}_\n`;
    }
  }
  
  message += `\n💰 *Total:* R$ ${order.total.toFixed(2)}\n`;
  
  if (order.deliveryType === 'delivery') {
    message += `📍 *Entrega:* ${order.deliveryAddress}\n`;
    message += `⏰ *Previsão:* 40-50 minutos\n`;
  } else {
    message += `🏪 *Retirada no local*\n`;
    message += `⏰ *Estará pronto em:* 30 minutos\n`;
  }
  
  message += `\n🔥 *Seu pedido já está sendo preparado!*`;
  
  return message;
}
```

---

## SCHEMA DO BANCO DE DADOS

### Novas Tabelas Necessárias:

```typescript
// drizzle/schema.ts

export const orderSessions = mysqlTable("order_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull().unique(),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  status: mysqlEnum("status", ["pending", "completed", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  deliveryAddress: text("deliveryAddress"),
  deliveryType: mysqlEnum("deliveryType", ["delivery", "pickup"]).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["pix", "card", "cash"]).notNull(),
  total: int("total").notNull(), // em centavos
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  menuItemId: int("menuItemId").notNull(),
  quantity: int("quantity").notNull(),
  observations: text("observations"),
  addons: text("addons"), // JSON array
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const botMessages = mysqlTable("bot_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

---

## ADAPTAÇÕES DO MERN FOOD ORDERING

### O que aproveitar:

1. **Frontend completo** (`client/src/pages/`):
   - `SearchPage.tsx` → Adaptar para `OrderPage.tsx`
   - `DetailPage.tsx` → Detalhes do restaurante/item
   - `CheckoutPage.tsx` → Finalização do pedido
   
2. **Componentes UI** (`client/src/components/`):
   - `MenuItem.tsx` → Card de item do menu
   - `Cart.tsx` → Carrinho flutuante
   - `CheckoutForm.tsx` → Formulário de checkout
   
3. **API Endpoints** (adaptar de REST para tRPC):
   - `GET /api/restaurant/:id` → `trpc.restaurant.getById`
   - `GET /api/menu/items` → `trpc.menu.getItems`
   - `POST /api/order/create` → `trpc.order.create`

### O que substituir:

1. **Auth0** → Manus Auth (já temos)
2. **Cloudinary** → S3 (já temos)
3. **Stripe** → PIX/Cartão local (ou manter)
4. **REST API** → tRPC (já temos)
5. **Mongoose** → Drizzle ORM (já temos)

---

## ROADMAP DE IMPLEMENTAÇÃO

### Fase 1: Preparação (1 semana)
- [ ] Adicionar tabelas ao schema
- [ ] Criar endpoints tRPC de pedidos
- [ ] Implementar geração de link único
- [ ] Atualizar prompt do bot

### Fase 2: Cardápio Web (2 semanas)
- [ ] Clonar componentes do MERN Food Ordering
- [ ] Adaptar para tRPC
- [ ] Implementar página de pedido
- [ ] Implementar carrinho
- [ ] Implementar checkout

### Fase 3: Integração WhatsApp (1 semana)
- [ ] Implementar webhook de notificação
- [ ] Formatar mensagem de confirmação
- [ ] Testar fluxo completo
- [ ] Implementar impressão de pedidos

### Fase 4: Admin (1 semana)
- [ ] Painel de gestão de pedidos
- [ ] Upload de fotos de pratos
- [ ] Gestão de cardápio
- [ ] Relatórios

---

## ESTIMATIVA DE ESFORÇO

**Total**: 5 semanas (1 desenvolvedor full-time)

**Alternativa rápida**: Usar TastyIgniter pronto (2 semanas de integração)

---

## RECOMENDAÇÃO FINAL

### Opção A: Adaptar MERN Food Ordering ⭐⭐⭐⭐⭐
**Prós**:
- Stack idêntica
- Código moderno e bem estruturado
- Features completas
- MIT license

**Contras**:
- Precisa adaptações (Auth, Storage, API)

**Tempo**: 5 semanas

---

### Opção B: Construir do Zero ⭐⭐⭐
**Prós**:
- Controle total
- Sem código legado

**Contras**:
- Mais tempo
- Mais bugs potenciais

**Tempo**: 8-10 semanas

---

### Opção C: Usar TastyIgniter ⭐⭐
**Prós**:
- Pronto para usar
- Muito maduro

**Contras**:
- PHP (stack diferente)
- Servidor separado

**Tempo**: 2-3 semanas (integração)

---

**DECISÃO RECOMENDADA**: **Opção A** (Adaptar MERN Food Ordering)
