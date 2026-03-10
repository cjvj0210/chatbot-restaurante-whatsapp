import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Clock, MessageCircle, Star, Hourglass } from "lucide-react";
import { trpc } from "@/lib/trpc";

// Calcula o tempo estimado de entrega baseado no dia da semana, horário e tipo de pedido
function calcularTempoEstimado(deliveryType: string): string {
  const now = new Date();
  const hora = now.getHours();
  const diaSemana = now.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab

  const isAlmoco = hora >= 11 && hora < 15;
  const isNoite = hora >= 18 && hora < 23;
  const isSegQuiAlmoco = diaSemana >= 1 && diaSemana <= 4; // Seg a Qui
  const isFimSemanaAlmoco = diaSemana === 5 || diaSemana === 6 || diaSemana === 0; // Sex, Sab, Dom

  if (deliveryType === "pickup") {
    if (isAlmoco) {
      if (isSegQuiAlmoco) return "30 min";
      if (isFimSemanaAlmoco) return "50 min";
    }
    if (isNoite) return "30 a 45 min";
    return "30 a 45 min";
  }

  // Delivery
  if (isAlmoco) {
    if (isSegQuiAlmoco) return "45 a 70 min";
    if (isFimSemanaAlmoco) return "60 a 110 min";
  }
  if (isNoite) return "45 a 70 min";
  return "45 a 70 min";
}

export default function Confirmacao() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [deliveryType, setDeliveryType] = useState<string>("delivery");
  const [orderNumber, setOrderNumber] = useState<string>("");

  const { data: order } = trpc.order.getBySession.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId, refetchInterval: 10000 } // Polling a cada 10s para atualizar status
  );

  useEffect(() => {
    if (sessionId) {
      localStorage.removeItem(`cart_${sessionId}`);
    }
    const savedType = localStorage.getItem("deliveryType");
    if (savedType) {
      setDeliveryType(savedType);
      localStorage.removeItem("deliveryType");
    }
  }, [sessionId]);

  useEffect(() => {
    if (order) {
      setOrderNumber(order.orderNumber || "");
      if (order.orderType) setDeliveryType(order.orderType);
    }
  }, [order]);

  const tempoEstimado = calcularTempoEstimado(deliveryType);
  const status = order?.status || "pending";
  const isConfirmed = status === "confirmed" || status === "preparing" || status === "ready" || status === "delivering" || status === "delivered";

  // Montar link do WhatsApp com número identificador do pedido
  const handleWhatsAppClick = () => {
    const numero = "5517982222790";
    const mensagem = orderNumber
      ? `Olá! Gostaria de acompanhar meu pedido *${orderNumber}*`
      : "Olá! Gostaria de acompanhar meu pedido";
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
  };

  return (
    <div
      className="min-h-screen bg-white max-w-md mx-auto flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header vermelho */}
      <div className="bg-red-700 text-white px-4 py-4">
        <h1 className="font-bold text-base">Churrascaria Estrela do Sul</h1>
        <p className="text-xs text-red-200">
          {isConfirmed ? "Seu pedido foi aceito!" : "Pedido recebido — aguardando aceite"}
        </p>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        {/* Ícone de status */}
        <div className="relative mb-6">
          {isConfirmed ? (
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-14 h-14 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center animate-pulse">
              <Hourglass className="w-12 h-12 text-orange-500" />
            </div>
          )}
          <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-lg">
            {isConfirmed ? "✅" : "⏳"}
          </div>
        </div>

        {isConfirmed ? (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Pedido Aceito!</h2>
            {orderNumber && (
              <p className="text-sm font-semibold text-red-700 mb-1">#{orderNumber}</p>
            )}
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              O restaurante aceitou seu pedido e já está preparando tudo com carinho para você!
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Pedido Recebido!</h2>
            {orderNumber && (
              <p className="text-sm font-semibold text-red-700 mb-1">#{orderNumber}</p>
            )}
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Seu pedido foi enviado ao restaurante e está <strong>aguardando aceite</strong>. Você será avisado pelo WhatsApp assim que for confirmado.
            </p>
          </>
        )}

        {/* Cards de informação */}
        <div className="w-full mt-8 space-y-3">

          {/* Status do pedido */}
          <div className={`w-full rounded-2xl p-4 flex items-start gap-3 text-left border-2 ${isConfirmed ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isConfirmed ? "bg-green-100" : "bg-orange-100"}`}>
              {isConfirmed ? (
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <Hourglass className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <div>
              <p className={`font-semibold text-sm ${isConfirmed ? "text-green-800" : "text-orange-800"}`}>
                {isConfirmed ? "✅ Pedido confirmado pelo restaurante!" : "⏳ Aguardando aceite do restaurante"}
              </p>
              <p className={`text-xs mt-0.5 leading-relaxed ${isConfirmed ? "text-green-700" : "text-orange-700"}`}>
                {isConfirmed
                  ? "O restaurante confirmou seu pedido. Preparação em andamento!"
                  : "Esta página atualiza automaticamente. Você também receberá aviso pelo WhatsApp."}
              </p>
            </div>
          </div>

          {/* Botão WhatsApp */}
          <button
            onClick={handleWhatsAppClick}
            className="w-full bg-green-50 rounded-2xl p-4 flex items-start gap-3 text-left hover:bg-green-100 active:bg-green-200 transition-colors cursor-pointer border-2 border-transparent hover:border-green-300"
          >
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm flex items-center gap-1">
                Acompanhe pelo WhatsApp
                <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full ml-1">Toque aqui</span>
              </p>
              <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
                {orderNumber
                  ? `Envie seu número de pedido (${orderNumber}) e receba o status em tempo real.`
                  : "Receba os detalhes do pedido e atualizações de status em tempo real."}
              </p>
            </div>
          </button>

          {/* Tempo estimado (só mostra se confirmado) */}
          {isConfirmed && (
            <div className="bg-orange-50 rounded-2xl p-4 flex items-start gap-3 text-left">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-orange-800 text-sm">
                  Tempo estimado: {tempoEstimado}
                </p>
                <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">
                  {deliveryType === "pickup"
                    ? "Seu pedido estará pronto para retirada no balcão."
                    : "Estamos preparando seu pedido com todo o carinho. Você será notificado quando estiver a caminho!"}
                </p>
              </div>
            </div>
          )}

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
            Churrascaria Estrela do Sul · Barretos/SP
          </p>
          <p className="text-xs text-gray-300 mt-1">
            {isConfirmed ? "Pedido confirmado com sucesso" : "Pedido recebido — aguardando confirmação"}
          </p>
        </div>
      </div>
    </div>
  );
}
