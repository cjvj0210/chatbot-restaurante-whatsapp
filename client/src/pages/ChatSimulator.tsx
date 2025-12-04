import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { nanoid } from "nanoid";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatSimulator() {
  // Gerar sessionId único para esta sessão de chat
  const sessionId = useMemo(() => nanoid(), []);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Seja bem-vindo à Churrascaria Estrela do Sul 🌟\n\nComo posso ajudá-lo hoje?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = trpc.chatSimulator.sendMessage.useMutation();
  const resetConversationMutation = trpc.chatSimulator.resetConversation.useMutation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    try {
      const response = await sendMessageMutation.mutateAsync({
        sessionId,
        message: input,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(response.timestamp),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = async () => {
    try {
      await resetConversationMutation.mutateAsync({ sessionId });
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Olá! Seja bem-vindo à Churrascaria Estrela do Sul 🌟\n\nComo posso ajudá-lo hoje?",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Erro ao resetar conversa:", error);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Simulador de Chat com IA Real</h1>
        <p className="text-muted-foreground">
          Converse naturalmente com o chatbot inteligente. Ele entende contexto e responde de forma personalizada!
        </p>
        <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm text-primary">
            ✨ <strong>Agora com IA conversacional real!</strong> O chatbot entende o contexto da conversa e responde especificamente para cada pergunta.
          </p>
        </div>
      </div>

      <Card className="h-[600px] flex flex-col">
        {/* Header */}
        <div className="border-b p-4 bg-primary text-primary-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Estrela do Sul" className="h-10 w-auto bg-white rounded px-2" />
            <div>
              <h2 className="font-semibold">Churrascaria Estrela do Sul</h2>
              <p className="text-xs opacity-90">Chatbot WhatsApp com IA</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetChat} 
            disabled={resetConversationMutation.isPending}
            className="bg-white/10 hover:bg-white/20 border-white/20"
          >
            {resetConversationMutation.isPending ? "Resetando..." : "Reiniciar"}
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
          
          {sendMessageMutation.isPending && (
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
              disabled={sendMessageMutation.isPending}
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || sendMessageMutation.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Dica: Converse naturalmente! Pergunte sobre pedidos, reservas, valores, horários, etc.
          </p>
        </div>
      </Card>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">📝 Sugestões de teste:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <button 
            onClick={() => { setInput("Quero fazer um pedido de marmitex"); }}
            className="text-left p-2 hover:bg-background rounded border"
            disabled={sendMessageMutation.isPending}
          >
            • "Quero fazer um pedido de marmitex"
          </button>
          <button 
            onClick={() => { setInput("Como funciona o rodízio de vocês?"); }}
            className="text-left p-2 hover:bg-background rounded border"
            disabled={sendMessageMutation.isPending}
          >
            • "Como funciona o rodízio de vocês?"
          </button>
          <button 
            onClick={() => { setInput("Quero fazer uma reserva para 4 pessoas no sábado"); }}
            className="text-left p-2 hover:bg-background rounded border"
            disabled={sendMessageMutation.isPending}
          >
            • "Quero fazer uma reserva para 4 pessoas no sábado"
          </button>
          <button 
            onClick={() => { setInput("Vocês entregam no bairro Fortaleza?"); }}
            className="text-left p-2 hover:bg-background rounded border"
            disabled={sendMessageMutation.isPending}
          >
            • "Vocês entregam no bairro Fortaleza?"
          </button>
        </div>
      </div>
    </div>
  );
}
