import { useState, useRef, useEffect, useCallback } from "react";
import { Send, RotateCcw, Smartphone, Mic, Square, ExternalLink, ShoppingBag, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  isOrderSummary?: boolean;
  orderId?: number;
}

// Formata valor em centavos para R$
function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// Renderiza texto com links clicáveis
function MessageText({ text, isOrderSummary }: { text: string; isOrderSummary?: boolean }) {
  if (isOrderSummary) {
    return <div className="text-sm whitespace-pre-wrap break-words">{text}</div>;
  }

  // Processar [ORDER_LINK:sessionId] - usa window.location.origin para garantir domínio correto
  const orderLinkRegex = /\[ORDER_LINK:([a-f0-9]+)\]/g;
  const processedText = text.replace(orderLinkRegex, (_, sessionId) => {
    return `${window.location.origin}/pedido/${sessionId}`;
  });

  // Detectar URLs no texto e transformar em links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = processedText.split(urlRegex);

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          urlRegex.lastIndex = 0;
          const isOrderLink = part.includes("/pedido/");
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 underline font-medium break-all ${
                isOrderLink
                  ? "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            >
              {isOrderLink ? (
                <>
                  <ShoppingBag className="w-3 h-3 flex-shrink-0" />
                  Abrir Cardápio Digital
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </>
              ) : (
                <>
                  {part}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </>
              )}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function Simulator() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Olá! Bem-vindo ao Simulador WhatsApp! 👋\n\nAqui você testa o Gaúchinho como se fosse uma conversa real pelo WhatsApp.\n\nExperimente:\n• Fazer um pedido delivery\n• Reservar uma mesa\n• Perguntar sobre o cardápio\n• Horário de funcionamento\n\nEnvie uma mensagem para começar!",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [activeOrderSessionId, setActiveOrderSessionId] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sessionId] = useState(() => `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const utils = trpc.useUtils();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling: verificar se o pedido foi finalizado no cardápio digital
  const checkOrderCompletion = useCallback(async (orderSessId: string) => {
    try {
      const result = await utils.chatSimulator.checkOrderStatus.fetch({ orderSessionId: orderSessId });
      if (result.status === "completed") {
        // Pedido finalizado! Buscar detalhes
        setPollingActive(false);
        setActiveOrderSessionId(null);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Buscar dados completos do pedido
        const order = await utils.order.getBySession.fetch({ sessionId: orderSessId });
        if (order) {
          const deliveryLabel = order.orderType === "delivery" ? "🚚 Delivery" : "🏠 Retirada";
          const paymentLabel = order.paymentMethod === "dinheiro" ? "💵 Dinheiro" : order.paymentMethod === "pix" ? "📱 PIX" : "💳 Cartão";

          let summaryText = `✅ Pedido recebido! Número: ${order.orderNumber}\n`;
          summaryText += `━━━━━━━━━━━━━━━━━━━━\n`;
          summaryText += `👤 ${order.customerName}\n`;
          summaryText += `📞 ${order.customerPhone}\n`;
          summaryText += `${deliveryLabel}`;
          if (order.deliveryAddress) summaryText += `\n📍 ${order.deliveryAddress}`;
          summaryText += `\n${paymentLabel}\n`;
          summaryText += `━━━━━━━━━━━━━━━━━━━━\n`;
          order.items.forEach((item: any) => {
            summaryText += `🍖 ${item.quantity}x ${item.menuItemName} — ${formatCurrency(item.unitPrice * item.quantity)}\n`;
            if (item.observations) summaryText += `   📝 ${item.observations}\n`;
          });
          summaryText += `━━━━━━━━━━━━━━━━━━━━\n`;
          summaryText += `Subtotal: ${formatCurrency(order.subtotal)}\n`;
          if (order.deliveryFee > 0) summaryText += `Entrega: ${formatCurrency(order.deliveryFee)}\n`;
          summaryText += `Total: ${formatCurrency(order.total)}\n`;
          if (order.estimatedTime) summaryText += `⏱️ Estimativa: ${order.estimatedTime} min\n`;
          if (order.customerNotes) summaryText += `📝 Obs: ${order.customerNotes}\n`;

          setMessages((prev) => [
            ...prev,
            {
              id: `order-summary-${Date.now()}`,
              text: summaryText,
              sender: "bot",
              timestamp: new Date(),
              isOrderSummary: true,
              orderId: order.id,
            },
            {
              id: `order-confirm-${Date.now()}`,
              text: "Agradecemos seu pedido e desejamos uma ótima refeição, nós da Estrela do Sul esperamos poder lhe atender em breve novamente! 😁🤠",
              sender: "bot",
              timestamp: new Date(),
            },
          ]);
        }
      }
    } catch (err) {
      console.error("[Simulator] Erro no polling:", err);
    }
  }, [utils]);

  // Iniciar polling quando há um pedido ativo
  useEffect(() => {
    if (activeOrderSessionId && pollingActive) {
      pollingIntervalRef.current = setInterval(() => {
        checkOrderCompletion(activeOrderSessionId);
      }, 3000); // Verificar a cada 3 segundos

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [activeOrderSessionId, pollingActive, checkOrderCompletion]);

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
      // Se gerou link de pedido, iniciar polling
      if (response.orderSessionId) {
        setActiveOrderSessionId(response.orderSessionId);
        setPollingActive(true);
      }
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

  const sendAudioMutation = trpc.chatSimulator.sendAudio.useMutation({
    onSuccess: (response) => {
      setIsProcessingAudio(false);
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
      if (response.orderSessionId) {
        setActiveOrderSessionId(response.orderSessionId);
        setPollingActive(true);
      }
    },
    onError: (error: any) => {
      setIsProcessingAudio(false);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `❌ Erro ao processar áudio: ${error.message}`,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    sendMessageMutation.mutate({ sessionId, message: inputText });
  };

  const handleReset = () => {
    // Parar polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setActiveOrderSessionId(null);
    setPollingActive(false);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            text: "🎤 Áudio gravado (processando...)",
            sender: "user",
            timestamp: new Date(),
          },
        ]);

        setIsProcessingAudio(true);
        setIsTyping(true);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(",")[1];
          sendAudioMutation.mutate({
            sessionId,
            audioBase64: base64Audio,
            mimeType: "audio/webm",
          });
        };

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Erro ao acessar microfone:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "❌ Erro ao acessar microfone. Verifique as permissões.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-primary" />
          Simulador WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Teste o Gaúchinho como se fosse uma conversa real pelo WhatsApp — com IA completa do restaurante
        </p>
      </div>

      {/* Indicador de pedido ativo */}
      {pollingActive && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span>Aguardando cliente finalizar o pedido no cardápio digital...</span>
        </div>
      )}

      <Card className="h-[600px] flex flex-col bg-[#e5ddd5] dark:bg-[#0b141a]">
        {/* Header WhatsApp */}
        <div className="bg-[#075e54] dark:bg-[#202c33] text-white p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
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
              <article
                aria-label={`${message.sender === "user" ? "Você" : "Bot"}: ${message.text?.slice(0, 100)}`}
                className={`max-w-[80%] rounded-lg p-3 shadow-sm ${
                  message.sender === "user"
                    ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white"
                    : message.isOrderSummary
                    ? "bg-white dark:bg-[#202c33] text-gray-900 dark:text-white border-l-4 border-green-500"
                    : "bg-white dark:bg-[#202c33] text-gray-900 dark:text-white"
                }`}
              >
                {message.isOrderSummary && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      Resumo do Pedido
                    </span>
                    {message.orderId && (
                      <a
                        href={`/imprimir/${message.orderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                      >
                        <Printer className="w-3 h-3" />
                        Imprimir
                      </a>
                    )}
                  </div>
                )}
                <MessageText text={message.text} isOrderSummary={message.isOrderSummary} />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {message.timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </article>
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
          {isTyping && (
            <p className="text-xs text-muted-foreground italic px-1 pb-2 text-center">
              Aguardando resposta...
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTyping || isProcessingAudio}
              aria-label={isRecording ? "Parar gravação" : "Gravar áudio"}
              className={`${
                isRecording
                  ? "bg-red-600 hover:bg-red-700 animate-pulse"
                  : "bg-[#075e54] hover:bg-[#064e47]"
              } text-white`}
            >
              {isRecording ? <Square className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
            </Button>
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              aria-label="Digite uma mensagem"
              className="flex-1 bg-white dark:bg-[#2a3942] border-none"
              disabled={isTyping || isRecording}
            />
            <Button
              onClick={handleSend}
              disabled={!inputText.trim() || isTyping || isRecording}
              aria-label="Enviar mensagem"
              className="bg-[#075e54] hover:bg-[#064e47] text-white"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Sugestões */}
      <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">Sugestões para testar:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "Quero fazer um pedido delivery",
            "Qual o cardápio?",
            "Reservar uma mesa",
            "Horário de funcionamento",
          ].map((tip) => (
            <button
              key={tip}
              onClick={() => setInputText(tip)}
              className="text-left text-xs bg-white text-blue-700 border border-blue-200 rounded-xl px-3 py-2 hover:bg-blue-50 transition-colors font-medium"
            >
              {tip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
