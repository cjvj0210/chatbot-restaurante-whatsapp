import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings,
  UtensilsCrossed,
  MessageSquare,
  Save,
  Copy,
  CheckCircle2,
  Wifi,
  WifiOff,
  DollarSign,
  Clock,
  MapPin,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "restaurant" | "whatsapp";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>("restaurant");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const { data: restaurantSettings, isLoading: restaurantLoading } =
    trpc.restaurant.getSettings.useQuery();
  const { data: whatsappSettings, isLoading: whatsappLoading } =
    trpc.whatsapp.getSettings.useQuery();

  const updateRestaurant = trpc.restaurant.updateSettings.useMutation({
    onSuccess: () => {
      utils.restaurant.getSettings.invalidate();
      toast.success("Configurações do restaurante atualizadas!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateWhatsapp = trpc.whatsapp.updateSettings.useMutation({
    onSuccess: () => {
      utils.whatsapp.getSettings.invalidate();
      toast.success("Configurações do WhatsApp atualizadas!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleRestaurantSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateRestaurant.mutate({
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      address: fd.get("address") as string,
      openingHours: fd.get("openingHours") as string,
      acceptsDelivery: (e.currentTarget.querySelector("#acceptsDelivery") as HTMLButtonElement)?.getAttribute("data-state") === "checked",
      acceptsReservation: (e.currentTarget.querySelector("#acceptsReservation") as HTMLButtonElement)?.getAttribute("data-state") === "checked",
      deliveryFee: Math.round(parseFloat(fd.get("deliveryFee") as string) * 100),
      minimumOrder: Math.round(parseFloat(fd.get("minimumOrder") as string) * 100),
      paymentMethods: fd.get("paymentMethods") as string,
    });
  };

  const handleWhatsappSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateWhatsapp.mutate({
      phoneNumberId: fd.get("phoneNumberId") as string,
      accessToken: fd.get("accessToken") as string,
      webhookVerifyToken: fd.get("webhookVerifyToken") as string,
      businessAccountId: (fd.get("businessAccountId") as string) || undefined,
      isActive: (e.currentTarget.querySelector("#isActive") as HTMLButtonElement)?.getAttribute("data-state") === "checked",
    });
  };

  const webhookUrl = `${window.location.origin}/api/webhook/whatsapp`;
  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const tabs = [
    { id: "restaurant" as Tab, label: "Restaurante", icon: UtensilsCrossed },
    { id: "whatsapp" as Tab, label: "WhatsApp Business", icon: MessageSquare },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie as informações do restaurante e integração com WhatsApp
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== ABA RESTAURANTE ===== */}
      {activeTab === "restaurant" && (
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50">
            <h2 className="font-semibold text-foreground">Informações do Restaurante</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estas informações são usadas pelo chatbot para responder clientes
            </p>
          </div>

          {restaurantLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleRestaurantSubmit} className="p-6 space-y-5">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground" />
                  Nome do Restaurante
                </Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={restaurantSettings?.name}
                  className="rounded-xl"
                  required
                />
              </div>

              {/* Telefone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  Telefone / WhatsApp
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={restaurantSettings?.phone}
                  className="rounded-xl"
                  required
                />
              </div>

              {/* Endereço */}
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Endereço
                </Label>
                <Textarea
                  id="address"
                  name="address"
                  defaultValue={restaurantSettings?.address}
                  className="rounded-xl resize-none"
                  rows={2}
                  required
                />
              </div>

              {/* Horário */}
              <div className="space-y-1.5">
                <Label htmlFor="openingHours" className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Horário de Funcionamento
                </Label>
                <Textarea
                  id="openingHours"
                  name="openingHours"
                  defaultValue={restaurantSettings?.openingHours}
                  placeholder="Ex: Seg-Sex: 11h às 23h | Sáb-Dom: 12h às 00h"
                  className="rounded-xl resize-none"
                  rows={2}
                  required
                />
              </div>

              {/* Formas de pagamento */}
              <div className="space-y-1.5">
                <Label htmlFor="paymentMethods" className="text-sm font-medium">
                  Formas de Pagamento
                </Label>
                <Input
                  id="paymentMethods"
                  name="paymentMethods"
                  defaultValue={restaurantSettings?.paymentMethods}
                  placeholder="Dinheiro, Cartão, PIX"
                  className="rounded-xl"
                  required
                />
              </div>

              {/* Taxa e mínimo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="deliveryFee" className="text-sm font-medium flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    Taxa de Entrega (R$)
                  </Label>
                  <Input
                    id="deliveryFee"
                    name="deliveryFee"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={restaurantSettings ? (restaurantSettings.deliveryFee / 100).toFixed(2) : "8.50"}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minimumOrder" className="text-sm font-medium">
                    Pedido Mínimo (R$)
                  </Label>
                  <Input
                    id="minimumOrder"
                    name="minimumOrder"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={restaurantSettings ? (restaurantSettings.minimumOrder / 100).toFixed(2) : "30.00"}
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delivery</p>
                    <p className="text-xs text-muted-foreground">Aceitar pedidos</p>
                  </div>
                  <Switch
                    id="acceptsDelivery"
                    name="acceptsDelivery"
                    defaultChecked={restaurantSettings?.acceptsDelivery ?? true}
                  />
                </div>
                <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Reservas</p>
                    <p className="text-xs text-muted-foreground">Aceitar reservas</p>
                  </div>
                  <Switch
                    id="acceptsReservation"
                    name="acceptsReservation"
                    defaultChecked={restaurantSettings?.acceptsReservation ?? true}
                  />
                </div>
              </div>

              {/* Botão salvar */}
              <button
                type="submit"
                disabled={updateRestaurant.isPending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {updateRestaurant.isPending ? "Salvando..." : "Salvar Configurações"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ===== ABA WHATSAPP ===== */}
      {activeTab === "whatsapp" && (
        <div className="space-y-4">
          {/* Status do chatbot */}
          <div className={`rounded-2xl p-4 flex items-center gap-3 ${
            whatsappSettings?.isActive ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"
          }`}>
            {whatsappSettings?.isActive ? (
              <Wifi className="w-5 h-5 text-green-600" />
            ) : (
              <WifiOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <p className={`font-semibold text-sm ${whatsappSettings?.isActive ? "text-green-700" : "text-gray-600"}`}>
                {whatsappSettings?.isActive ? "Chatbot Ativo" : "Chatbot Inativo"}
              </p>
              <p className={`text-xs ${whatsappSettings?.isActive ? "text-green-600" : "text-gray-500"}`}>
                {whatsappSettings?.isActive
                  ? "Recebendo e respondendo mensagens do WhatsApp"
                  : "Configure abaixo para ativar o chatbot"}
              </p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50">
              <h2 className="font-semibold text-foreground">WhatsApp Cloud API</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Credenciais do Meta for Developers para integração com WhatsApp Business
              </p>
            </div>

            {whatsappLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <form onSubmit={handleWhatsappSubmit} className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumberId" className="text-sm font-medium">
                    Phone Number ID
                  </Label>
                  <Input
                    id="phoneNumberId"
                    name="phoneNumberId"
                    defaultValue={whatsappSettings?.phoneNumberId}
                    placeholder="Obtido no Meta for Developers"
                    className="rounded-xl"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontrado em: Meta Business → WhatsApp → Configuração
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="accessToken" className="text-sm font-medium">
                    Access Token
                  </Label>
                  <Input
                    id="accessToken"
                    name="accessToken"
                    type="password"
                    defaultValue={whatsappSettings?.accessToken}
                    placeholder="Token de acesso permanente"
                    className="rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="webhookVerifyToken" className="text-sm font-medium">
                    Webhook Verify Token
                  </Label>
                  <Input
                    id="webhookVerifyToken"
                    name="webhookVerifyToken"
                    defaultValue={whatsappSettings?.webhookVerifyToken}
                    placeholder="Token de verificação (você define)"
                    className="rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="businessAccountId" className="text-sm font-medium">
                    Business Account ID{" "}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="businessAccountId"
                    name="businessAccountId"
                    defaultValue={whatsappSettings?.businessAccountId || ""}
                    placeholder="ID da conta de negócios"
                    className="rounded-xl"
                  />
                </div>

                {/* URL do Webhook */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">URL do Webhook</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted/50 rounded-xl px-4 py-2.5 text-sm text-muted-foreground font-mono truncate">
                      {webhookUrl}
                    </div>
                    <button
                      type="button"
                      onClick={copyWebhook}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted/50 transition-colors shrink-0"
                    >
                      {copiedWebhook ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copiedWebhook ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cole esta URL no campo "Callback URL" do Meta for Developers
                  </p>
                </div>

                {/* Toggle ativo */}
                <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Chatbot Ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Ativar ou pausar o atendimento automático
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    name="isActive"
                    defaultChecked={whatsappSettings?.isActive ?? false}
                  />
                </div>

                <button
                  type="submit"
                  disabled={updateWhatsapp.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {updateWhatsapp.isPending ? "Salvando..." : "Salvar Configurações"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
