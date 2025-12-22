import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Phone, User, CreditCard, Bike, Store } from "lucide-react";

interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  observations?: string;
}

export default function Checkout() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();

  // Estado do formulário
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartao" | "pix">("dinheiro");
  const [changeFor, setChangeFor] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar carrinho do localStorage
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart_${sessionId}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    } else {
      // Se não tem carrinho, volta para a página de pedido
      setLocation(`/pedido/${sessionId}`);
    }
  }, [sessionId, setLocation]);

  // Validar sessão
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
      // Limpar carrinho
      localStorage.removeItem(`cart_${sessionId}`);
      // Redirecionar para página de confirmação
      setLocation(`/pedido/${sessionId}/confirmacao`);
    },
    onError: (error) => {
      alert(`Erro ao criar pedido: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone) {
      alert("Por favor, preencha nome e telefone");
      return;
    }

    if (deliveryType === "delivery" && !address) {
      alert("Por favor, preencha o endereço de entrega");
      return;
    }

    setIsSubmitting(true);

    // Calcular total
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Preparar dados do pedido
    const orderData = {
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
    };

    createOrderMutation.mutate(orderData);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (validating || cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/pedido/${sessionId}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
            <p className="text-sm text-gray-600">Churrascaria Estrela do Sul</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Seus Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  placeholder="João Silva"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (WhatsApp) *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Tipo de Entrega */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Entrega</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={deliveryType} onValueChange={(v) => setDeliveryType(v as "delivery" | "pickup")}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Bike className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Delivery</p>
                      <p className="text-sm text-gray-600">Entrega no endereço</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Store className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Retirada</p>
                      <p className="text-sm text-gray-600">Retirar no restaurante</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {deliveryType === "delivery" && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="address">Endereço completo *</Label>
                  <Textarea
                    id="address"
                    placeholder="Rua, número, bairro, complemento..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    required={deliveryType === "delivery"}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="dinheiro" id="dinheiro" />
                  <Label htmlFor="dinheiro" className="cursor-pointer flex-1">Dinheiro</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="cartao" id="cartao" />
                  <Label htmlFor="cartao" className="cursor-pointer flex-1">Cartão (na entrega)</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="pix" id="pix" />
                  <Label htmlFor="pix" className="cursor-pointer flex-1">PIX</Label>
                </div>
              </RadioGroup>

              {paymentMethod === "dinheiro" && (
                <div className="space-y-2">
                  <Label htmlFor="change">Troco para quanto? (opcional)</Label>
                  <Input
                    id="change"
                    type="number"
                    step="0.01"
                    placeholder="R$ 0,00"
                    value={changeFor}
                    onChange={(e) => setChangeFor(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações Adicionais */}
          <Card>
            <CardHeader>
              <CardTitle>Observações Adicionais</CardTitle>
              <CardDescription>Alguma informação importante sobre seu pedido?</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ex: Interfone não funciona, ligar ao chegar..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Resumo do Pedido */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium">
                      {item.quantity}x {item.name}
                    </p>
                    {item.observations && (
                      <p className="text-xs text-orange-600 italic">Obs: {item.observations}</p>
                    )}
                  </div>
                  <p className="font-semibold">R$ {((item.price * item.quantity) / 100).toFixed(2)}</p>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between items-center">
                <p className="text-lg font-bold">Total</p>
                <p className="text-2xl font-bold text-green-600">R$ {(total / 100).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Botão de Confirmação */}
          <Button
            type="submit"
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando pedido..." : "Confirmar Pedido"}
          </Button>
        </form>
      </div>
    </div>
  );
}
