import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors = {
  pending: "bg-yellow-500",
  confirmed: "bg-blue-500",
  preparing: "bg-purple-500",
  ready: "bg-green-500",
  delivering: "bg-indigo-500",
  delivered: "bg-gray-500",
  cancelled: "bg-red-500",
};

const statusLabels = {
  pending: "Pendente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto",
  delivering: "Em Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export default function Orders() {
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.orders.list.useQuery();

  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      toast.success("Status atualizado com sucesso!");
    },
  });

  const handleStatusChange = (orderId: number, newStatus: keyof typeof statusLabels) => {
    updateStatus.mutate({ id: orderId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Pedidos</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-32"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Pedidos</h1>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Nenhum pedido realizado ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const items = JSON.parse(order.items);
            return (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Pedido #{order.orderNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <Badge className={statusColors[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Itens:</h4>
                      <ul className="space-y-1">
                        {items.map((item: { name: string; quantity: number; price: number }, idx: number) => (
                          <li key={idx} className="text-sm">
                            {item.quantity}x {item.name} - R$ {((item.price * item.quantity) / 100).toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Subtotal: R$ {(order.subtotal / 100).toFixed(2)}</p>
                        {order.deliveryFee > 0 && (
                          <p className="text-sm text-muted-foreground">Taxa de Entrega: R$ {(order.deliveryFee / 100).toFixed(2)}</p>
                        )}
                        <p className="font-semibold">Total: R$ {(order.total / 100).toFixed(2)}</p>
                      </div>
                      <Badge variant="outline">{order.orderType === "delivery" ? "Delivery" : "Retirada"}</Badge>
                    </div>

                    {order.deliveryAddress && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Endereço de Entrega:</h4>
                        <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                      </div>
                    )}

                    {order.customerNotes && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Observações:</h4>
                        <p className="text-sm text-muted-foreground">{order.customerNotes}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <label className="text-sm font-medium">Alterar Status:</label>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value as keyof typeof statusLabels)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="confirmed">Confirmado</SelectItem>
                          <SelectItem value="preparing">Preparando</SelectItem>
                          <SelectItem value="ready">Pronto</SelectItem>
                          <SelectItem value="delivering">Em Entrega</SelectItem>
                          <SelectItem value="delivered">Entregue</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
