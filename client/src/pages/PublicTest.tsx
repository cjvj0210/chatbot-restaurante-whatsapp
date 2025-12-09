import { useState, useRef, useEffect } from "react";
import { Send, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
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

    sendMessageMutation.mutate({
      sessionId,
      message: inputText,
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
              onClick={handleSend}
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
