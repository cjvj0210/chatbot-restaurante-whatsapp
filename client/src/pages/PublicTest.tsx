import { useState, useRef, useEffect } from "react";
import { Send, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

// Detecta se a URL é do cardápio digital (link de pedido)
function isMenuLink(url: string): boolean {
  return /\/pedido\/[a-f0-9]{32}/i.test(url);
}

// Card visual para o link do cardápio digital
function MenuLinkCard({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block mt-2 rounded-xl overflow-hidden border border-[#075e54]/30 bg-gradient-to-r from-[#075e54] to-[#128c7e] text-white no-underline hover:opacity-90 transition-opacity"
    >
      <div className="flex items-center gap-3 p-3">
        <div className="text-3xl flex-shrink-0">🛒</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-tight">Cardápio Digital</div>
          <div className="text-xs text-white/80 mt-0.5">Toque aqui para montar seu pedido →</div>
        </div>
        <div className="text-xl flex-shrink-0">➡️</div>
      </div>
    </a>
  );
}

// Converte URLs no texto em links clicáveis ou cards visuais
function renderMessageText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      if (isMenuLink(part)) {
        return <MenuLinkCard key={i} url={part} />;
      }
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-600 dark:text-blue-400 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    // Renderiza quebras de linha preservadas
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  showHumanButtons?: boolean; // exibe botões Sim/Não para atendente humano
}

// Detecta se a mensagem do bot está oferecendo atendente humano
function detectHumanHandoff(text: string): boolean {
  const patterns = [
    /transferir.*atendente/i,
    /atendente humano/i,
    /falar com.*atendente/i,
    /conectar.*equipe/i,
    /quer.*atendente/i,
    /prefere.*atendente/i,
    /encaminhar.*atendente/i,
  ];
  return patterns.some((p) => p.test(text));
}

export default function PublicTest() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Olá! Bem-vindo ao teste do nosso chatbot! 👋\n\nEste é um ambiente de testes. Sinta-se à vontade para conversar e testar todas as funcionalidades.\n\nExperimente:\n• Perguntar sobre o cardápio\n• Fazer um pedido\n• Reservar uma mesa\n• Usar o botão 🎤 para enviar áudio\n\nEnvie uma mensagem para começar!",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Gerar sessionId único para esta sessão de teste
  const [sessionId] = useState(() => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const sendMessageMutation = trpc.publicTest.sendMessage.useMutation({
    onSuccess: (response: { message: string; timestamp: Date }) => {
      setIsTyping(false);
      const botText = response.message;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: botText,
          sender: "bot",
          timestamp: new Date(response.timestamp),
          showHumanButtons: detectHumanHandoff(botText),
        },
      ]);
    },
    onError: (error: any) => {
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

  const sendAudioMutation = trpc.publicTest.sendAudio.useMutation({
    onSuccess: (response: { message: string; transcription: string; timestamp: Date }) => {
      setIsProcessingAudio(false);
      setIsTyping(false);
      const botText = response.message;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: botText,
          sender: "bot",
          timestamp: new Date(response.timestamp),
          showHumanButtons: detectHumanHandoff(botText),
        },
      ]);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (overrideText?: string) => {
    const text = overrideText ?? inputText;
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
    };

    // Desativa botões de atendente nas mensagens anteriores
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showHumanButtons: false })),
      userMessage,
    ]);
    setInputText("");
    setIsTyping(true);

    sendMessageMutation.mutate({
      sessionId,
      message: text,
    });
  };

  const handleHumanYes = () => {
    // Oculta botões e envia resposta afirmativa
    setMessages((prev) => prev.map((m) => ({ ...m, showHumanButtons: false })));
    const userMessage: Message = {
      id: Date.now().toString(),
      text: "Sim, quero falar com um atendente",
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    sendMessageMutation.mutate({
      sessionId,
      message: "Sim, quero falar com um atendente",
    });
  };

  const handleHumanNo = () => {
    // Oculta botões e envia resposta negativa
    setMessages((prev) => prev.map((m) => ({ ...m, showHumanButtons: false })));
    const userMessage: Message = {
      id: Date.now().toString(),
      text: "Não, obrigado",
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    sendMessageMutation.mutate({
      sessionId,
      message: "Não, obrigado",
    });
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
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
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
          const base64Audio = (reader.result as string).split(',')[1];
          
          sendAudioMutation.mutate({
            sessionId,
            audioBase64: base64Audio,
            mimeType: 'audio/webm',
          });
        };

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e5ddd5] dark:bg-[#0b141a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[90vh] flex flex-col bg-white dark:bg-[#0b141a] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#075e54] dark:bg-[#202c33] text-white p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            🍴
          </div>
          <div>
            <h3 className="font-semibold text-lg">Churrascaria Estrela do Sul</h3>
            <p className="text-xs text-white/70">Teste do Chatbot</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5] dark:bg-[#0b141a]">
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
                <p className="text-sm break-words">{renderMessageText(message.text)}</p>
                {message.showHumanButtons && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleHumanYes}
                      className="flex-1 bg-[#075e54] hover:bg-[#064e47] text-white text-xs font-semibold py-1.5 px-3 rounded-full transition-colors"
                    >
                      Sim 👍
                    </button>
                    <button
                      onClick={handleHumanNo}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white text-xs font-semibold py-1.5 px-3 rounded-full transition-colors"
                    >
                      Não, obrigado
                    </button>
                  </div>
                )}
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
        <div className="bg-[#f0f0f0] dark:bg-[#202c33] p-3">
          <div className="flex gap-2">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTyping || isProcessingAudio}
              className={`${
                isRecording 
                  ? "bg-red-600 hover:bg-red-700 animate-pulse" 
                  : "bg-[#075e54] hover:bg-[#064e47]"
              } text-white`}
              title={isRecording ? "Parar gravação" : "Gravar áudio"}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              className="flex-1 bg-white dark:bg-[#2a3942] border-none"
              disabled={isTyping || isRecording}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isTyping || isRecording}
              className="bg-[#075e54] hover:bg-[#064e47] text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
