import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Clock, MessageCircle, Star, Hourglass } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * Retorna o intervalo de minutos e o horário estimado de chegada
 * conforme os tempos configurados no cardápio digital:
 *   - Delivery Seg-Sex: 45–70 min
 *   - Delivery Sáb-Dom: 60–110 min
 *   - Retirada (todos os dias): 30–50 min
 */
function calcularEstimativa(deliveryType: string): {
  intervalo: string;
  horarioMin: string;
  horarioMax: string;
} {
  const now = new Date();
  const diaSemana = now.getDay(); // 0=Dom, 1=Seg … 6=Sab
  const isFimSemana = diaSemana === 0 || diaSemana === 6;

  let minMin: number;
  let minMax: number;

  if (deliveryType === "pickup") {
    minMin = 30;
    minMax = 50;
  } else if (isFimSemana) {
    minMin = 60;
    minMax = 110;
  } else {
    minMin = 45;
    minMax = 70;
  }

  const toHHMM = (date: Date) =>
    date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const chegadaMin = new Date(now.getTime() + minMin * 60 * 1000);
  const chegadaMax = new Date(now.getTime() + minMax * 60 * 1000);

  return {
    intervalo: `${minMin} a ${minMax} min`,
    horarioMin: toHHMM(chegadaMin),
    horarioMax: toHHMM(chegadaMax),
  };
}

export default function Confirmacao() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [deliveryType, setDeliveryType] = useState<string>("delivery");
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [estimativa] = useState(() => calcularEstimativa("delivery")); // será atualizado abaixo

  const { data: order } = trpc.order.getBySession.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId, refetchInterval: 10000 }
  );

  const [estimativaFinal, setEstimativaFinal] = useState(estimativa);

  useEffect(() => {
    if (sessionId) {
      localStorage.removeItem(`cart_${sessionId}`);
    }
    const savedType = localStorage.getItem("deliveryType");
    if (savedType) {
      setDeliveryType(savedType);
      setEstimativaFinal(calcularEstimativa(savedType));
      localStorage.removeItem("deliveryType");
    }
  }, [sessionId]);

  useEffect(() => {
    if (order) {
      setOrderNumber(order.orderNumber || "");
      if (order.orderType) {
        setDeliveryType(order.orderType);
        setEstimativaFinal(calcularEstimativa(order.orderType));
      }
    }
  }, [order]);

  const status = order?.status || "pending";
  const isConfirmed =
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready" ||
    status === "delivering" ||
    status === "delivered";

  const handleWhatsAppClick = () => {
    // Número de teste do bot (trocar para o número oficial quando for ao ar: 5517982222790)
    const numero = "5517992253886";
    const mensagem = orderNumber
      ? `Olá! Gostaria de acompanhar meu pedido *${orderNumber}*`
      : "Olá! Gostaria de acompanhar meu pedido";
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank");
  };

  const isPickup = deliveryType === "pickup";

  return (
    <div
      className="min-h-screen bg-white max-w-md mx-auto flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
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
            {orderNumber && <p className="text-sm font-semibold text-red-700 mb-1">#{orderNumber}</p>}
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              O restaurante aceitou seu pedido e já está preparando tudo com carinho para você!
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Pedido Recebido!</h2>
            {orderNumber && <p className="text-sm font-semibold text-red-700 mb-1">#{orderNumber}</p>}
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Seu pedido foi enviado ao restaurante e está <strong>aguardando aceite</strong>. Você será avisado pelo WhatsApp assim que for confirmado.
            </p>
          </>
        )}

        {/* Cards de informação */}
        <div className="w-full mt-8 space-y-3">

          {/* ===== ESTIMATIVA DE HORÁRIO — visível SEMPRE, desde o recebimento ===== */}
          <div className="bg-orange-50 rounded-2xl p-4 flex items-start gap-3 text-left border-2 border-orange-200">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-orange-800 text-sm">
                {isPickup ? "🏃 Retirada estimada" : "🛵 Entrega estimada"}
              </p>
              <p className="text-xl font-extrabold text-orange-700 mt-0.5">
                {estimativaFinal.horarioMin} – {estimativaFinal.horarioMax}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                {isPickup
                  ? `Seu pedido estará pronto para retirada no balcão em aprox. ${estimativaFinal.intervalo}.`
                  : `Previsão de chegada em aprox. ${estimativaFinal.intervalo} a partir de agora.`}
              </p>
              {!isConfirmed && (
                <p className="text-[11px] text-orange-400 mt-1 italic">
                  * O tempo começa a contar após o aceite do restaurante.
                </p>
              )}
            </div>
          </div>

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
          <p className="text-xs text-gray-400">Churrascaria Estrela do Sul · Barretos/SP</p>
          <p className="text-xs text-gray-300 mt-1">
            {isConfirmed ? "Pedido confirmado com sucesso" : "Pedido recebido — aguardando confirmação"}
          </p>
        </div>
      </div>
    </div>
  );
}
