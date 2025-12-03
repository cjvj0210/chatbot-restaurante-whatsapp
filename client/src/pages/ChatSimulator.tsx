import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatSimulator() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Seja bem-vindo à Churrascaria Estrela do Sul 🌟\n\nComo posso ajudá-lo hoje?\n\n1️⃣ Fazer um pedido de delivery\n2️⃣ Fazer uma reserva\n3️⃣ Ver informações do rodízio\n4️⃣ Falar com atendente",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateResponse = async (userMessage: string) => {
    setIsTyping(true);
    
    // Simular delay de resposta
    await new Promise(resolve => setTimeout(resolve, 1000));

    let response = "";
    const lowerMessage = userMessage.toLowerCase();

    // Detecção de intenção simples
    if (lowerMessage.includes("pedido") || lowerMessage.includes("delivery") || lowerMessage.includes("marmit") || lowerMessage === "1") {
      response = "Ótimo! Vou te ajudar com seu pedido de delivery 📦\n\nNosso cardápio está sendo finalizado. Em breve você poderá:\n\n• Escolher entre Marmitex, Pratos Executivos e Kits de Carne\n• Adicionar bebidas e acompanhamentos\n• Informar endereço de entrega\n• Escolher forma de pagamento\n\n💰 Taxa de entrega: R$ 7,00\n📍 Raio: 6km do restaurante\n⏱️ Tempo médio: 45min a 1h40 (varia por dia)\n\nPor enquanto, este é um simulador. Quer testar outro fluxo?";
    } else if (lowerMessage.includes("reserva") || lowerMessage === "2") {
      response = "Perfeito! Vou te ajudar com sua reserva 📅\n\nPara fazer uma reserva, preciso de:\n\n1️⃣ Data e horário desejados\n2️⃣ Número de pessoas\n3️⃣ Seu nome e telefone\n\n🕐 Horários disponíveis:\n• Almoço: Todos os dias 11h-15h\n• Jantar: Terça a Domingo 19h-22h45\n\nQual data e horário você prefere?";
    } else if (lowerMessage.includes("rodízio") || lowerMessage.includes("valor") || lowerMessage.includes("preço") || lowerMessage.includes("quanto") || lowerMessage === "3") {
      response = "🍖 **Rodízio Completo Estrela do Sul**\n\nInclui: Carnes nobres, buffet ibérico com queijos nobres, presunto serrano, salame, comida japonesa, sobremesas e saladas.\n\n💰 **Valores:**\n\n**Almoço:**\n• Seg-Sex: R$ 119,90\n• Sáb-Dom: R$ 129,90\n\n**Jantar (Ter-Dom):**\n• Individual: R$ 109,90\n• 🔥 Casal: R$ 199,90 (PROMOÇÃO!)\n\n👶 Crianças:\n• Até 5 anos: GRÁTIS\n• 5-12 anos: Preço promocional\n• 13+ anos: Valor adulto\n\n*Bebidas e taxa de serviço (10%) à parte\n\nGostaria de fazer uma reserva?";
    } else if (lowerMessage.includes("horário") || lowerMessage.includes("funcionamento") || lowerMessage.includes("aberto")) {
      response = "🕐 **Horários de Funcionamento:**\n\n**Almoço (Rodízio + Delivery):**\nTodos os dias: 11h às 15h\n\n**Jantar (Rodízio + Delivery):**\nTerça a Domingo: 19h às 22h45\n\n⚠️ Exceção: Sábado à noite não fazemos delivery de marmitas\n❌ Fechado: Segunda-feira à noite\n\nPosso ajudar com mais alguma informação?";
    } else if (lowerMessage.includes("endereço") || lowerMessage.includes("local") || lowerMessage.includes("onde")) {
      response = "📍 **Nosso Endereço:**\n\nAv. Engenheiro Necker Carmago de Carvalho\nRua 36, nº 1885\nBarretos - SP\n\n📞 **Telefones:**\n• Fixo: (17) 3325-8628\n• WhatsApp: (17) 98222-2790\n\nEstamos aqui desde 1998! 🌟";
    } else if (lowerMessage.includes("pagamento") || lowerMessage.includes("pagar") || lowerMessage.includes("forma")) {
      response = "💳 **Formas de Pagamento:**\n\n✅ Dinheiro\n✅ PIX\n✅ Cartão de Crédito\n✅ Cartão de Débito\n✅ Vale-Refeição\n✅ Vale-Alimentação\n\nAceitamos todas essas opções tanto no rodízio quanto no delivery!";
    } else if (lowerMessage.includes("atendente") || lowerMessage.includes("humano") || lowerMessage.includes("pessoa") || lowerMessage === "4") {
      response = "Entendo! Vou transferir você para um atendente humano 👤\n\n⏱️ Aguarde um momento que alguém da nossa equipe irá atendê-lo em breve.\n\n*Obs: Esta é uma simulação. Na versão real, sua conversa seria transferida para a equipe.*";
    } else if (lowerMessage.includes("obrigad") || lowerMessage.includes("valeu") || lowerMessage.includes("tchau")) {
      response = "Por nada! Foi um prazer atendê-lo 😊\n\nEstamos sempre à disposição!\n\n🌟 Churrascaria Estrela do Sul\n📞 (17) 98222-2790\n\nVolte sempre!";
    } else {
      response = "Desculpe, não entendi muito bem 😅\n\nPosso ajudá-lo com:\n\n1️⃣ Pedidos de delivery\n2️⃣ Reservas de mesa\n3️⃣ Informações sobre o rodízio\n4️⃣ Horários e localização\n5️⃣ Formas de pagamento\n\nO que você gostaria de saber?";
    }

    setIsTyping(false);
    
    const assistantMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    await simulateResponse(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Olá! Seja bem-vindo à Churrascaria Estrela do Sul 🌟\n\nComo posso ajudá-lo hoje?\n\n1️⃣ Fazer um pedido de delivery\n2️⃣ Fazer uma reserva\n3️⃣ Ver informações do rodízio\n4️⃣ Falar com atendente",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Simulador de Chat</h1>
        <p className="text-muted-foreground">
          Teste o chatbot como se fosse um cliente real. Experimente fazer pedidos, reservas e tirar dúvidas!
        </p>
      </div>

      <Card className="h-[600px] flex flex-col">
        {/* Header */}
        <div className="border-b p-4 bg-primary text-primary-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Estrela do Sul" className="h-10 w-auto bg-white rounded px-2" />
            <div>
              <h2 className="font-semibold">Churrascaria Estrela do Sul</h2>
              <p className="text-xs opacity-90">Chatbot WhatsApp</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetChat} className="bg-white/10 hover:bg-white/20 border-white/20">
            Reiniciar
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted"
              }`}>
                {message.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className={`flex-1 max-w-[70%] ${message.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-card border p-3 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4 bg-background">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1"
              disabled={isTyping}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Dica: Experimente perguntar sobre pedidos, reservas, valores do rodízio, horários, etc.
          </p>
        </div>
      </Card>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">📝 Sugestões de teste:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <button 
            onClick={() => { setInput("Quero fazer um pedido"); }}
            className="text-left p-2 hover:bg-background rounded border"
          >
            • "Quero fazer um pedido"
          </button>
          <button 
            onClick={() => { setInput("Fazer uma reserva para 4 pessoas"); }}
            className="text-left p-2 hover:bg-background rounded border"
          >
            • "Fazer uma reserva para 4 pessoas"
          </button>
          <button 
            onClick={() => { setInput("Qual o valor do rodízio?"); }}
            className="text-left p-2 hover:bg-background rounded border"
          >
            • "Qual o valor do rodízio?"
          </button>
          <button 
            onClick={() => { setInput("Qual o horário de funcionamento?"); }}
            className="text-left p-2 hover:bg-background rounded border"
          >
            • "Qual o horário de funcionamento?"
          </button>
        </div>
      </div>
    </div>
  );
}
