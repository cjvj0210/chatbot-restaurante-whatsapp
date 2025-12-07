import { useState, useRef, useEffect } from "react";
import { Send, RotateCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export default function Simulator() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Olá! Bem-vindo ao Simulador de Conversas! 👋\n\nAqui você pode testar o chatbot como se estivesse conversando pelo WhatsApp.\n\nExperimente perguntar sobre:\n• Cardápio e preços\n• Fazer um pedido\n• Reservar uma mesa\n• Horário de funcionamento\n\nEnvie uma mensagem para começar!",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessionId] = useState(() => `session-${Date.now()}`);

  const sendMessageMutation = trpc.chatSimulator.sendMessage.useMutation({
    onSuccess: (response) => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: response.message,
          sender: "bot",
          timestamp: new Date(response.timestamp),
        },
      ]);
    },
    onError: (error) => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `❌ Erro: ${error.message}`,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const resetMutation = trpc.chatSimulator.resetConversation.useMutation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    // Enviar para o chatbot
    sendMessageMutation.mutate({
      sessionId,
      message: inputText,
    });
  };

  const handleReset = () => {
    resetMutation.mutate({ sessionId });
    setMessages([
      {
        id: "welcome",
        text: "Conversa reiniciada! 🔄\n\nEnvie uma mensagem para começar uma nova conversa.",
        sender: "bot",
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Smartphone className="w-8 h-8 text-green-600" />
          <h1 className="text-3xl font-bold">Simulador de Conversas WhatsApp</h1>
        </div>
        <p className="text-muted-foreground">
          Teste o chatbot antes de colocar em produção. Todas as funcionalidades estão ativas!
        </p>
      </div>

      <Card className="h-[600px] flex flex-col bg-[#e5ddd5] dark:bg-[#0b141a]">
        {/* Header */}
        <div className="bg-[#075e54] dark:bg-[#202c33] text-white p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              🍴
            </div>
            <div>
              <h3 className="font-semibold">Churrascaria Estrela do Sul</h3>
              <p className="text-xs text-white/70">Online</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-white hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reiniciar
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg p-3 shadow-sm ${
                  message.sender === "user"
                    ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white"
                    : "bg-white dark:bg-[#202c33] text-gray-900 dark:text-white"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {message.timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-[#202c33] rounded-lg p-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-[#f0f0f0] dark:bg-[#202c33] p-3 rounded-b-lg">
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              className="flex-1 bg-white dark:bg-[#2a3942] border-none"
              disabled={isTyping}
            />
            <Button
              onClick={handleSend}
              disabled={!inputText.trim() || isTyping}
              className="bg-[#075e54] hover:bg-[#064e47] text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Dicas */}
      <Card className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Dicas de Teste:</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Experimente perguntar "Qual o cardápio?" ou "Quero fazer um pedido"</li>
          <li>• Teste fazer uma reserva: "Gostaria de reservar uma mesa"</li>
          <li>• Pergunte sobre horários: "Qual o horário de funcionamento?"</li>
          <li>• Teste o tom de voz e naturalidade das respostas</li>
          <li>• Use o botão "Reiniciar" para começar uma nova conversa do zero</li>
        </ul>
      </Card>
    </div>
  );
}
