import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Phone,
  User,
  Banknote,
  CreditCard,
  QrCode,
  Bike,
  Store,
  ChevronRight,
  Clock,
  CheckCircle2,
} from "lucide-react";

interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  observations?: string;
}

type DeliveryType = "delivery" | "pickup";
type PaymentMethod = "dinheiro" | "cartao" | "pix";

export default function Checkout() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=dados, 2=entrega, 3=pagamento
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(() => {
    // Lê o tipo de entrega escolhido na tela inicial do cardápio
    const saved = localStorage.getItem(`deliveryType_${sessionId}`);
    return (saved as DeliveryType) || "delivery";
  });
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart_${sessionId}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    } else {
      setLocation(`/pedido/${sessionId}`);
    }
  }, [sessionId, setLocation]);

  const { data: validation, isLoading: validating } = trpc.orderLink.validate.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  useEffect(() => {
    if (!validating && !validation?.valid) {
      setLocation("/");
    }
  }, [validation, validating, setLocation]);

  const createOrderMutation = trpc.order.create.useMutation({
    onSuccess: () => {
      localStorage.removeItem(`cart_${sessionId}`);
      localStorage.removeItem(`deliveryType_${sessionId}`);
      setLocation(`/pedido/${sessionId}/confirmacao`);
    },
    onError: (error) => {
      alert(`Erro ao criar pedido: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Por favor, preencha nome e telefone");
      return;
    }
    if (deliveryType === "delivery" && !address.trim()) {
      alert("Por favor, preencha o endereço de entrega");
      return;
    }
    setIsSubmitting(true);
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    createOrderMutation.mutate({
      sessionId: sessionId!,
      customerName,
      customerPhone,
      deliveryType,
      address: deliveryType === "delivery" ? address : undefined,
      paymentMethod,
      changeFor: paymentMethod === "dinheiro" && changeFor ? parseFloat(changeFor) * 100 : undefined,
      additionalNotes: additionalNotes || undefined,
      totalAmount,
      items: cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        observations: item.observations,
      })),
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = deliveryType === "delivery" ? 850 : 0;
  const total = subtotal + deliveryFee;

  const formatPrice = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const steps = [
    { id: 1, label: "Seus dados" },
    { id: 2, label: "Entrega" },
    { id: 3, label: "Pagamento" },
  ];

  const canProceedStep1 = customerName.trim().length >= 2 && customerPhone.replace(/\D/g, "").length >= 10;
  const canProceedStep2 = deliveryType === "pickup" || address.trim().length > 5;

  if (validating || cart.length === 0) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto p-4 space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <div className="bg-red-700 text-white sticky top-0 z-30 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : setLocation(`/pedido/${sessionId}`))}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base">Finalizar Pedido</h1>
            <p className="text-xs text-red-200">Churrascaria Estrela do Sul</p>
          </div>
        </div>

        {/* Progress steps */}
        <div className="px-4 pb-3 flex items-center gap-0">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step > s.id
                      ? "bg-green-400 text-white"
                      : step === s.id
                      ? "bg-white text-red-700"
                      : "bg-white/20 text-white/60"
                  }`}
                >
                  {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
                </div>
                <span
                  className={`text-xs mt-0.5 whitespace-nowrap ${
                    step >= s.id ? "text-white" : "text-white/50"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 mb-4 transition-all ${
                    step > s.id ? "bg-green-400" : "bg-white/20"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto pb-32 px-4 pt-4 space-y-4">

        {/* ===== STEP 1: DADOS DO CLIENTE ===== */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-red-600" />
                Seus dados
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="João Silva"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="(17) 99999-9999"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Usaremos para confirmar seu pedido via WhatsApp
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 2: TIPO DE ENTREGA ===== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                Como você quer receber?
              </h2>

              <button
                onClick={() => setDeliveryType("delivery")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  deliveryType === "delivery"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    deliveryType === "delivery" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <Bike className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Delivery</p>
                  <p className="text-xs text-gray-500">Entrega no seu endereço · {formatPrice(850)}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    deliveryType === "delivery" ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  {deliveryType === "delivery" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  )}
                </div>
              </button>

              <button
                onClick={() => setDeliveryType("pickup")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  deliveryType === "pickup"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    deliveryType === "pickup" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Retirada no local</p>
                  <p className="text-xs text-gray-500">Retire no restaurante · Grátis</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    deliveryType === "pickup" ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  {deliveryType === "pickup" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  )}
                </div>
              </button>
            </div>

            {/* Campo de endereço */}
            {deliveryType === "delivery" && (
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-600" />
                  Endereço de entrega
                </h3>
                <textarea
                  placeholder="Rua, número, bairro, complemento..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                />
              </div>
            )}

            {/* Observações */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">
                Observações do pedido <span className="text-gray-400 font-normal">(opcional)</span>
              </h3>
              <textarea
                placeholder="Ex: Interfone não funciona, ligar ao chegar..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
              />
            </div>
          </div>
        )}

        {/* ===== STEP 3: PAGAMENTO ===== */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-red-600" />
                Forma de pagamento
              </h2>

              {/* PIX */}
              <button
                onClick={() => setPaymentMethod("pix")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "pix"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    paymentMethod === "pix" ? "bg-red-600 text-white" : "bg-gray-200"
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-800 text-sm">PIX</p>
                  <p className="text-xs text-gray-500">Pagamento instantâneo</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === "pix" ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  {paymentMethod === "pix" && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                </div>
              </button>

              {/* Cartão */}
              <button
                onClick={() => setPaymentMethod("cartao")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "cartao"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === "cartao" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Cartão na entrega</p>
                  <p className="text-xs text-gray-500">Débito ou crédito</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === "cartao" ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  {paymentMethod === "cartao" && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                </div>
              </button>

              {/* Dinheiro */}
              <button
                onClick={() => setPaymentMethod("dinheiro")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "dinheiro"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === "dinheiro" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Dinheiro</p>
                  <p className="text-xs text-gray-500">Pagamento na entrega</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === "dinheiro" ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  {paymentMethod === "dinheiro" && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                </div>
              </button>

              {paymentMethod === "dinheiro" && (
                <div className="pt-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Troco para quanto? <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Resumo do pedido */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-800 text-sm">Resumo do pedido</h3>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={`${item.menuItemId}-${item.observations}`} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span className="text-gray-700">
                        {item.quantity}x {item.name}
                      </span>
                      {item.observations && (
                        <p className="text-xs text-orange-500 italic">Obs: {item.observations}</p>
                      )}
                    </div>
                    <span className="font-medium text-gray-800 ml-2">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {deliveryType === "delivery" && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Taxa de entrega</span>
                    <span>{formatPrice(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-800 pt-1">
                  <span>Total</span>
                  <span className="text-red-600 text-lg">{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            {/* Info de entrega */}
            <div className="bg-orange-50 rounded-xl p-3 flex items-start gap-2 text-xs text-orange-700">
              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Tempo estimado: 30-50 minutos</p>
                <p className="mt-0.5 text-orange-600">
                  {deliveryType === "delivery"
                    ? `Entrega para: ${address}`
                    : "Retirada no restaurante"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botão de ação fixo */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40 bg-gradient-to-t from-gray-50 pt-4">
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            className="w-full bg-red-600 text-white py-4 rounded-2xl shadow-xl flex items-center justify-between px-6 hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-bold text-base"
          >
            <span />
            <span>Continuar</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-green-600 text-white py-4 rounded-2xl shadow-xl flex items-center justify-between px-6 hover:bg-green-700 transition-colors disabled:opacity-60 font-bold text-base"
          >
            <span />
            <span>{isSubmitting ? "Enviando pedido..." : `Confirmar Pedido · ${formatPrice(total)}`}</span>
            <CheckCircle2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
