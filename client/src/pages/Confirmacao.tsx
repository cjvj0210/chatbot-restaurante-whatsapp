import { useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle2, MessageCircle, Clock, Star } from "lucide-react";

export default function Confirmacao() {
  const { sessionId } = useParams<{ sessionId: string }>();

  useEffect(() => {
    if (sessionId) {
      localStorage.removeItem(`cart_${sessionId}`);
    }
  }, [sessionId]);

  return (
    <div
      className="min-h-screen bg-white max-w-md mx-auto flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header vermelho */}
      <div className="bg-red-700 text-white px-4 py-4">
        <h1 className="font-bold text-base">Churrascaria Estrela do Sul</h1>
        <p className="text-xs text-red-200">Seu pedido foi recebido!</p>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        {/* Ícone de sucesso animado */}
        <div className="relative mb-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-lg">
            🎉
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-2">Pedido Confirmado!</h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          Recebemos seu pedido com sucesso. Em breve você receberá uma confirmação pelo WhatsApp.
        </p>

        {/* Cards de informação */}
        <div className="w-full mt-8 space-y-3">
          <div className="bg-green-50 rounded-2xl p-4 flex items-start gap-3 text-left">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-800 text-sm">Acompanhe pelo WhatsApp</p>
              <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
                Você receberá uma mensagem com os detalhes do pedido e atualizações de status em tempo real.
              </p>
            </div>
          </div>

          <div className="bg-orange-50 rounded-2xl p-4 flex items-start gap-3 text-left">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-orange-800 text-sm">Tempo estimado: 30-50 min</p>
              <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">
                Estamos preparando seu pedido com todo o carinho. Você será notificado quando estiver a caminho!
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-2xl p-4 flex items-start gap-3 text-left">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="font-semibold text-yellow-800 text-sm">Obrigado pela preferência!</p>
              <p className="text-xs text-yellow-700 mt-0.5 leading-relaxed">
                Esperamos que você aproveite muito! Qualquer dúvida, fale conosco pelo WhatsApp. 🤠
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-10 text-center">
          <p className="text-xs text-gray-400">
            Churrascaria Estrela do Sul · São José do Rio Preto/SP
          </p>
          <p className="text-xs text-gray-300 mt-1">Pedido realizado com sucesso</p>
        </div>
      </div>
    </div>
  );
}
