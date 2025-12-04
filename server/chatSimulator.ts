import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getRestaurantSettings } from "./db";

// Armazenamento em memória das conversas (em produção, usar banco de dados)
const conversations = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

export const chatSimulatorRouter = router({
  sendMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { sessionId, message } = input;

      // Buscar informações do restaurante
      const settings = await getRestaurantSettings();

      // Obter histórico da conversa
      let history = conversations.get(sessionId) || [];

      // Adicionar mensagem do usuário ao histórico
      history.push({ role: "user", content: message });

      // Criar system prompt com informações do restaurante
      const systemPrompt = `Você é um atendente virtual da Churrascaria Estrela do Sul, um restaurante tradicional de Barretos-SP desde 1998.

**TOM DE VOZ:**
- Formal, porém muito empático e humano
- Demonstre atenção e interesse genuíno pelo cliente
- Sempre que possível, atenda pedidos específicos
- Quando não for possível atender, explique de maneira humana e lamente sinceramente
- Use emojis moderadamente e de forma contextual

**INFORMAÇÕES DO RESTAURANTE:**
${settings ? `
- Nome: ${settings.name}
- Endereço: ${settings.address}
- Telefone Fixo: ${settings.phone}
- Horário: ${settings.openingHours}
` : ''}

**RODÍZIO COMPLETO:**
Inclui: Carnes nobres, buffet ibérico com queijos nobres, presunto serrano, salame, comida japonesa, sobremesas e saladas.

**Valores do Rodízio:**
- Almoço Segunda a Sexta: R$ 119,90
- Almoço Sábado e Domingo: R$ 129,90
- Jantar (Terça a Domingo) Individual: R$ 109,90
- Jantar (Terça a Domingo) Casal: R$ 199,90 (PROMOÇÃO!)
- Crianças até 5 anos: GRÁTIS
- Crianças 5-12 anos: Preço promocional
- A partir de 13 anos: Valor adulto
- Bebidas e taxa de serviço (10%) à parte

**DELIVERY:**
- Taxa de entrega: R$ 7,00 (fixa)
- Pedido mínimo: R$ 20,00
- Raio de entrega: 6km
- Tempo médio: 45min a 1h40 (varia por dia/período)
- Oferecemos: Marmitex, Pratos Executivos, Kits de Carne, Guarnições
- Exceção: Sábado à noite NÃO fazemos delivery

**FORMAS DE PAGAMENTO:**
Dinheiro, PIX, Cartão Crédito/Débito, Vale-Refeição, Vale-Alimentação

**RESERVAS:**
- Almoço: Todos os dias 11h-15h
- Jantar: Terça a Domingo 19h-22h45
- Segunda-feira à noite: FECHADO

**INSTRUÇÕES:**
1. Responda de forma natural e conversacional
2. Use o contexto da conversa anterior
3. Seja específico nas respostas, não repita informações já dadas
4. Se o cliente fizer uma pergunta sobre algo já mencionado, elabore mais ou dê detalhes diferentes
5. Para pedidos de delivery, colete: itens, endereço, forma de pagamento
6. Para reservas, colete: data, horário, número de pessoas, nome e telefone
7. Se não souber algo, seja honesto e ofereça transferir para atendente humano
8. Sempre termine oferecendo ajuda adicional

**IMPORTANTE:** Este é um simulador para testes. Lembre o cliente disso quando ele finalizar pedidos ou reservas.`;

      // Preparar mensagens para a IA
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ];

      // Chamar IA
      const response = await invokeLLM({ messages });

      const assistantMessage = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content 
        : "Desculpe, não consegui processar sua mensagem.";

      // Adicionar resposta ao histórico
      history.push({ role: "assistant", content: assistantMessage });

      // Limitar histórico a últimas 20 mensagens para não sobrecarregar
      if (history.length > 20) {
        history = history.slice(-20);
      }

      // Salvar histórico atualizado
      conversations.set(sessionId, history);

      return {
        message: assistantMessage,
        timestamp: new Date(),
      };
    }),

  resetConversation: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      conversations.delete(input.sessionId);
      return { success: true };
    }),
});
