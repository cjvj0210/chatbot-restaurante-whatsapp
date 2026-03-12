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
  RefreshCw,
  Star,
  AlertTriangle,
} from "lucide-react";
import { checkBusinessHours } from "../../../shared/businessHours";

interface SelectedAddon {
  groupId: number;
  groupName: string;
  optionId: number;
  optionName: string;
  priceExtra: number;
  quantity?: number;
}
interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  observations?: string;
  addons?: SelectedAddon[];
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
    const saved = localStorage.getItem(`deliveryType_${sessionId}`);
    return (saved as DeliveryType) || "delivery";
  });
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressReference, setAddressReference] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const address = [addressStreet, addressNumber, addressNeighborhood, addressReference, addressComplement].filter(Boolean).join(" - ");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  // Controle do modal de confirmação de endereço
  const [showAddressConfirm, setShowAddressConfirm] = useState(false);
  const [savedAddressFull, setSavedAddressFull] = useState("");
  const [usingNewAddress, setUsingNewAddress] = useState(false);

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

  // Buscar dados do cliente pelo WhatsApp da sessão
  const { data: customerData } = trpc.order.getCustomerByWhatsapp.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId && !prefillApplied }
  );

  // Pré-preencher dados quando o cliente for encontrado
  useEffect(() => {
    if (customerData && !prefillApplied) {
      if (customerData.name) setCustomerName(customerData.name);
      if (customerData.phone) setCustomerPhone(formatPhone(customerData.phone));
      if (customerData.address) {
        setSavedAddressFull(customerData.address);
      }
      setPrefillApplied(true);
    }
  }, [customerData, prefillApplied]);

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

  // Ao avançar do step 1 para step 2, verificar se há endereço salvo
  const handleProceedStep1 = () => {
    if (savedAddressFull && deliveryType === "delivery") {
      setShowAddressConfirm(true);
    } else {
      setStep(2);
    }
  };

  // Usar endereço salvo
  const handleUseSavedAddress = () => {
    // Tentar separar o endereço salvo nos campos individuais
    const parts = savedAddressFull.split(" - ");
    if (parts.length >= 1) setAddressStreet(parts[0] || "");
    if (parts.length >= 2) setAddressNumber(parts[1] || "");
    if (parts.length >= 3) setAddressNeighborhood(parts[2] || "");
    if (parts.length >= 4) setAddressReference(parts[3] || "");
    if (parts.length >= 5) setAddressComplement(parts[4] || "");
    setShowAddressConfirm(false);
    setStep(2);
  };

  const updateCustomerAddressMutation = trpc.order.updateCustomerAddress.useMutation();

  // Usar novo endereço
  const handleUseNewAddress = () => {
    setAddressStreet("");
    setAddressNumber("");
    setAddressNeighborhood("");
    setAddressReference("");
    setAddressComplement("");
    setUsingNewAddress(true);
    setShowAddressConfirm(false);
    setStep(2);
  };

  const handleSubmit = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Por favor, preencha nome e telefone");
      return;
    }
    // Validar data de nascimento apenas quando o campo está visível (cliente sem data cadastrada)
    if (!customerData?.birthDate && birthDate && birthDate.replace(/\D/g, "").length !== 8) {
      alert("Por favor, preencha a data de nascimento corretamente (DD/MM/AAAA)");
      return;
    }
    if (deliveryType === "delivery") {
      if (!addressStreet.trim()) { alert("Por favor, preencha o endereço (Rua/Avenida)"); return; }
      if (!addressNumber.trim()) { alert("Por favor, preencha o número"); return; }
      if (!addressNeighborhood.trim()) { alert("Por favor, preencha o bairro"); return; }
      if (!addressReference.trim()) { alert("Por favor, preencha a referência"); return; }
    }
    setIsSubmitting(true);
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Se o cliente escolheu um novo endereço, salvar no banco automaticamente
    if (usingNewAddress && deliveryType === "delivery" && address.trim()) {
      updateCustomerAddressMutation.mutate({ sessionId: sessionId!, address });
    }
    createOrderMutation.mutate({
      sessionId: sessionId!,
      customerName,
      customerPhone,
      deliveryType,
      address: deliveryType === "delivery" ? address : undefined,
      paymentMethod,
      changeFor: paymentMethod === "dinheiro" && changeFor ? parseFloat(changeFor) * 100 : undefined,
      additionalNotes: additionalNotes || undefined,
      birthDate: birthDate || undefined,
      totalAmount,
      items: cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        observations: item.observations,
        addons: item.addons && item.addons.length > 0 ? item.addons : undefined,
      })),
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = deliveryType === "delivery" ? 850 : 0;
  const total = subtotal + deliveryFee;

  const formatPrice = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const formatPhone = (value: string) => {
    // Remove tudo que não é dígito
    let digits = value.replace(/\D/g, "");
    // Remove o prefixo 55 (Brasil) se o número tiver mais de 11 dígitos (ex: 5517988112791 → 17988112791)
    if (digits.startsWith("55") && digits.length > 11) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);
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
  const canProceedStep2 = deliveryType === "pickup" || (addressStreet.trim().length > 2 && addressNumber.trim().length > 0 && addressNeighborhood.trim().length > 2 && addressReference.trim().length > 2);

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
      {/* Modal de confirmação de endereço */}
      {showAddressConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Entregar no mesmo endereço?</h3>
                <p className="text-xs text-gray-500">Seu último endereço cadastrado</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <p className="text-sm text-gray-700 leading-relaxed">{savedAddressFull}</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleUseSavedAddress}
                className="w-full bg-red-600 text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Sim, entregar aqui
              </button>
              <button
                onClick={handleUseNewAddress}
                className="w-full bg-white text-gray-700 py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Não, quero informar outro endereço
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Banner de cliente reconhecido */}
            {customerData && prefillApplied && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-800">Olá, {customerData.name?.split(" ")[0]}! 👋</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Seus dados foram preenchidos automaticamente.
                    {customerData.totalOrders > 0 && ` Você já fez ${customerData.totalOrders} pedido${customerData.totalOrders > 1 ? "s" : ""} conosco!`}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-red-600" />
                Seus dados
              </h2>

              {/* Campo de nome: oculto quando cliente já é reconhecido */}
              {!(customerData && prefillApplied && customerData.name) && (
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
              )}

              {/* Campo de data de nascimento: apenas quando o cliente ainda não tem a data cadastrada */}
              {customerData !== undefined && !customerData?.birthDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Data de nascimento <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={birthDate}
                    maxLength={10}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                      if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
                      setBirthDate(v.slice(0, 10));
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1">Para receber promoções especiais no seu aniversário 🎂</p>
                </div>
              )}

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
                <Bike className="w-5 h-5 text-red-600" />
                Como quer receber?
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDeliveryType("delivery")}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                    deliveryType === "delivery"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Bike className={`w-6 h-6 ${deliveryType === "delivery" ? "text-red-600" : "text-gray-400"}`} />
                  <span className={`text-sm font-semibold ${deliveryType === "delivery" ? "text-red-700" : "text-gray-600"}`}>
                    Delivery
                  </span>
                  <span className="text-xs text-gray-400">R$ 8,50</span>
                </button>
                <button
                  onClick={() => setDeliveryType("pickup")}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                    deliveryType === "pickup"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Store className={`w-6 h-6 ${deliveryType === "pickup" ? "text-red-600" : "text-gray-400"}`} />
                  <span className={`text-sm font-semibold ${deliveryType === "pickup" ? "text-red-700" : "text-gray-600"}`}>
                    Retirada
                  </span>
                  <span className="text-xs text-gray-400">Grátis</span>
                </button>
              </div>
            </div>

            {deliveryType === "delivery" && (
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-600" />
                  Endereço de entrega
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Rua / Avenida <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Rua das Flores"
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Número <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Complemento
                    </label>
                    <input
                      type="text"
                      placeholder="Apto 12"
                      value={addressComplement}
                      onChange={(e) => setAddressComplement(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Bairro <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Centro"
                    value={addressNeighborhood}
                    onChange={(e) => setAddressNeighborhood(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ponto de referência <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Próximo à Igreja São João"
                    value={addressReference}
                    onChange={(e) => setAddressReference(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                  />
                </div>
              </div>
            )}

            {deliveryType === "pickup" && (
              <div className="bg-orange-50 rounded-2xl p-4 flex items-start gap-3 text-sm text-orange-700">
                <Store className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Retirada no restaurante</p>
                  <p className="text-xs mt-1 text-orange-600">
                    Churrascaria Estrela do Sul — Av. Principal, Centro
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Observações do pedido
              </label>
              <textarea
                placeholder="Alguma observação especial? (opcional)"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all resize-none"
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
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === "pix" ? "border-red-500 bg-red-50" : "border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === "pix" ? "bg-red-100" : "bg-gray-100"}`}>
                  <QrCode className={`w-5 h-5 ${paymentMethod === "pix" ? "text-red-600" : "text-gray-500"}`} />
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
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === "cartao" ? "border-red-500 bg-red-50" : "border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === "cartao" ? "bg-red-100" : "bg-gray-100"}`}>
                  <CreditCard className={`w-5 h-5 ${paymentMethod === "cartao" ? "text-red-600" : "text-gray-500"}`} />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Cartão</p>
                  <p className="text-xs text-gray-500">Débito ou crédito na entrega</p>
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
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === "dinheiro" ? "border-red-500 bg-red-50" : "border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === "dinheiro" ? "bg-red-100" : "bg-gray-100"}`}>
                  <Banknote className={`w-5 h-5 ${paymentMethod === "dinheiro" ? "text-red-600" : "text-gray-500"}`} />
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
            {(() => {
              const bh = checkBusinessHours(deliveryType);
              const d = new Date().getDay();
              const fds = d === 0 || d === 6;
              const tempoEst = deliveryType === 'pickup' ? '30 a 50 min' : (fds ? '60 a 110 min' : '45 a 70 min');
              return (
                <>
                  <div className="bg-orange-50 rounded-xl p-3 flex items-start gap-2 text-xs text-orange-700">
                    <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Tempo estimado: {tempoEst}</p>
                      <p className="mt-0.5 text-orange-600">
                        {deliveryType === "delivery"
                          ? `Entrega para: ${address}`
                          : "Retirada no restaurante"}
                      </p>
                    </div>
                  </div>
                  {bh.isEarlyOrder && bh.earlyOrderMessage && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-700">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                      <p className="leading-relaxed">{bh.earlyOrderMessage}</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Botão de ação fixo */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40 bg-gradient-to-t from-gray-50 pt-4">
        {step === 1 ? (
          <button
            onClick={handleProceedStep1}
            disabled={!canProceedStep1}
            className="w-full bg-red-600 text-white py-4 rounded-2xl shadow-xl flex items-center justify-between px-6 hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-bold text-base"
          >
            <span />
            <span>Continuar</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : step === 2 ? (
          <button
            onClick={() => setStep(3)}
            disabled={!canProceedStep2}
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
