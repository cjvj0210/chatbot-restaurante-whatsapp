import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: restaurantSettings, isLoading: restaurantLoading } = trpc.restaurant.getSettings.useQuery();
  const { data: whatsappSettings, isLoading: whatsappLoading } = trpc.whatsapp.getSettings.useQuery();

  const updateRestaurant = trpc.restaurant.updateSettings.useMutation({
    onSuccess: () => {
      utils.restaurant.getSettings.invalidate();
      toast.success("Configurações do restaurante atualizadas!");
    },
  });

  const updateWhatsapp = trpc.whatsapp.updateSettings.useMutation({
    onSuccess: () => {
      utils.whatsapp.getSettings.invalidate();
      toast.success("Configurações do WhatsApp atualizadas!");
    },
  });

  const handleRestaurantSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    updateRestaurant.mutate({
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      openingHours: formData.get("openingHours") as string,
      acceptsDelivery: formData.get("acceptsDelivery") === "on",
      acceptsReservation: formData.get("acceptsReservation") === "on",
      deliveryFee: Math.round(parseFloat(formData.get("deliveryFee") as string) * 100),
      minimumOrder: Math.round(parseFloat(formData.get("minimumOrder") as string) * 100),
      paymentMethods: formData.get("paymentMethods") as string,
    });
  };

  const handleWhatsappSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    updateWhatsapp.mutate({
      phoneNumberId: formData.get("phoneNumberId") as string,
      accessToken: formData.get("accessToken") as string,
      webhookVerifyToken: formData.get("webhookVerifyToken") as string,
      businessAccountId: formData.get("businessAccountId") as string || undefined,
      isActive: formData.get("isActive") === "on",
    });
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>

      <Tabs defaultValue="restaurant" className="space-y-4">
        <TabsList>
          <TabsTrigger value="restaurant">Restaurante</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Business</TabsTrigger>
        </TabsList>

        <TabsContent value="restaurant">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Restaurante</CardTitle>
              <CardDescription>
                Configure as informações básicas do seu restaurante que serão usadas pelo chatbot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {restaurantLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleRestaurantSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Restaurante</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={restaurantSettings?.name}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={restaurantSettings?.phone}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Endereço</Label>
                    <Textarea
                      id="address"
                      name="address"
                      defaultValue={restaurantSettings?.address}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="openingHours">Horário de Funcionamento</Label>
                    <Textarea
                      id="openingHours"
                      name="openingHours"
                      defaultValue={restaurantSettings?.openingHours}
                      placeholder="Ex: Segunda a Sexta: 11h às 23h, Sábado e Domingo: 12h às 00h"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethods">Formas de Pagamento</Label>
                    <Input
                      id="paymentMethods"
                      name="paymentMethods"
                      defaultValue={restaurantSettings?.paymentMethods}
                      placeholder="Ex: Dinheiro, Cartão de Crédito, Débito, Pix"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="deliveryFee">Taxa de Entrega (R$)</Label>
                      <Input
                        id="deliveryFee"
                        name="deliveryFee"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={restaurantSettings ? (restaurantSettings.deliveryFee / 100).toFixed(2) : "0.00"}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="minimumOrder">Pedido Mínimo (R$)</Label>
                      <Input
                        id="minimumOrder"
                        name="minimumOrder"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={restaurantSettings ? (restaurantSettings.minimumOrder / 100).toFixed(2) : "0.00"}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="acceptsDelivery"
                      name="acceptsDelivery"
                      defaultChecked={restaurantSettings?.acceptsDelivery}
                    />
                    <Label htmlFor="acceptsDelivery">Aceita Delivery</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="acceptsReservation"
                      name="acceptsReservation"
                      defaultChecked={restaurantSettings?.acceptsReservation}
                    />
                    <Label htmlFor="acceptsReservation">Aceita Reservas</Label>
                  </div>

                  <Button type="submit" disabled={updateRestaurant.isPending}>
                    {updateRestaurant.isPending ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do WhatsApp Business API</CardTitle>
              <CardDescription>
                Configure a integração com a WhatsApp Cloud API. Você precisa criar um aplicativo no Meta for Developers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {whatsappLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleWhatsappSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                    <Input
                      id="phoneNumberId"
                      name="phoneNumberId"
                      defaultValue={whatsappSettings?.phoneNumberId}
                      placeholder="Obtido no Meta for Developers"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                      id="accessToken"
                      name="accessToken"
                      type="password"
                      defaultValue={whatsappSettings?.accessToken}
                      placeholder="Token de acesso permanente"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
                    <Input
                      id="webhookVerifyToken"
                      name="webhookVerifyToken"
                      defaultValue={whatsappSettings?.webhookVerifyToken}
                      placeholder="Token de verificação do webhook (você define)"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="businessAccountId">Business Account ID (Opcional)</Label>
                    <Input
                      id="businessAccountId"
                      name="businessAccountId"
                      defaultValue={whatsappSettings?.businessAccountId || ""}
                      placeholder="ID da conta de negócios"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      name="isActive"
                      defaultChecked={whatsappSettings?.isActive}
                    />
                    <Label htmlFor="isActive">Chatbot Ativo</Label>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">URL do Webhook:</p>
                    <code className="text-sm">
                      {window.location.origin}/api/webhook/whatsapp
                    </code>
                  </div>

                  <Button type="submit" disabled={updateWhatsapp.isPending}>
                    {updateWhatsapp.isPending ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
