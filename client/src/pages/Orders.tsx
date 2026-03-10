import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Printer,
  Send,
  MapPin,
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: "Pendente",    bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400" },
  confirmed:  { label: "Confirmado",  bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500" },
  preparing:  { label: "Preparando",  bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500" },
  ready:      { label: "Pronto",      bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500" },
  delivering: { label: "Em Entrega",  bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500" },
  delivered:  { label: "Entregue",    bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400" },
  cancelled:  { label: "Cancelado",   bg: "bg-red-50",     text: "text-red-600",    dot: "bg-red-500" },
};

const statusFlow = ["pending", "confirmed", "preparing", "ready", "delivering", "delivered"];

interface OrderItem {
  id?: number;
  menuItemId?: number;
  name: string;
  quantity: number;
  price: number;
  observations?: string | null;
  addons?: string | null;
}

export default function Orders() {
  const utils = trpc.useUtils();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  type StatusEnum = "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";
  const { data: orders, isLoading } = trpc.order.list.useQuery(
    filterStatus !== "all" ? { status: filterStatus as StatusEnum } : undefined
  );

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      utils.order.list.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatus.mutate({ orderId, status: newStatus as StatusEnum });
  };

  const getNextStatus = (current: string, orderType: string) => {
    const idx = statusFlow.indexOf(current);
    if (idx === -1 || idx >= statusFlow.length - 1) return null;
    if (current === "ready" && orderType === "pickup") return "delivered";
    return statusFlow[idx + 1];
  };

  const pendingCount = orders?.filter((o) => o.status === "pending").length ?? 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Pedidos
            {pendingCount > 0 && (
              <span className="ml-1 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} novo{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie e acompanhe todos os pedidos
          </p>
        </div>

        {/* Filtro de status */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 h-9 text-sm rounded-xl border-border/60">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pedidos</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                    {v.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de pedidos */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1.5" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full mb-1.5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : !orders?.length ? (
        <div className="bg-card rounded-2xl border border-border/50 py-16 text-center">
          <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">Nenhum pedido encontrado</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {filterStatus !== "all" ? "Tente outro filtro de status" : "Os pedidos aparecerão aqui"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = statusConfig[order.status] ?? statusConfig.pending;
            const isExpanded = expandedId === order.id;
            // Usar itens normalizados com nomes (orderItemsList) ou fallback para JSON legado
            const items: OrderItem[] = (() => {
              if ((order as any).orderItemsList && (order as any).orderItemsList.length > 0) {
                return (order as any).orderItemsList;
              }
              try { return JSON.parse(order.items); } catch { return []; }
            })();
            const nextStatus = getNextStatus(order.status, order.orderType ?? "delivery");

            return (
              <div
                key={order.id}
                className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  order.status === "pending" ? "border-amber-300/60 ring-1 ring-amber-200" : "border-border/50"
                }`}
              >
                {/* Linha de progresso de status */}
                <div className="h-1 w-full bg-muted">
                  <div
                    className={`h-full transition-all ${status.dot}`}
                    style={{
                      width: `${((statusFlow.indexOf(order.status) + 1) / statusFlow.length) * 100}%`,
                    }}
                  />
                </div>

                {/* Header do card */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    {order.orderType === "delivery" ? (
                      <MapPin className="w-5 h-5 text-primary" />
                    ) : (
                      <Store className="w-5 h-5 text-primary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground text-sm">
                        #{order.orderNumber}
                      </p>
                      <span className="text-muted-foreground/40">·</span>
                      <p className="font-semibold text-foreground text-sm truncate">
                        {order.customerName}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(order.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })} ·{" "}
                      {order.orderType === "delivery" ? "Delivery" : "Retirada"} ·{" "}
                      <span className="font-semibold text-foreground">
                        R$ {(order.total / 100).toFixed(2).replace(".", ",")}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`status-badge ${status.bg} ${status.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="border-t border-border/40 px-5 py-4 space-y-4">
                    {/* Itens do pedido */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Itens do Pedido
                      </p>
                      <div className="space-y-1.5">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <div>
                              <span className="font-medium text-foreground">
                                {item.quantity}x {item.name}
                              </span>
                              {item.observations && (
                                <p className="text-xs text-orange-500 italic">
                                  Obs: {item.observations}
                                </p>
                              )}
                            </div>
                            <span className="text-muted-foreground">
                              R$ {((item.price * item.quantity) / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totais */}
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span>R$ {(order.subtotal / 100).toFixed(2)}</span>
                      </div>
                      {order.deliveryFee > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Taxa de entrega</span>
                          <span>R$ {(order.deliveryFee / 100).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border/40">
                        <span>Total</span>
                        <span className="text-primary">R$ {(order.total / 100).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Endereço */}
                    {order.deliveryAddress && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{order.deliveryAddress}</span>
                      </div>
                    )}

                    {/* Observações */}
                    {order.customerNotes && (
                      <div className="bg-orange-50 rounded-xl px-3 py-2 text-sm text-orange-700">
                        <span className="font-semibold">Obs: </span>
                        {order.customerNotes}
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => window.open(`/print-order/${order.id}`, "_blank")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir
                      </button>

                      {nextStatus && (
                        <button
                          onClick={() => handleStatusChange(order.id, nextStatus)}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                          {updateStatus.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Avançar para{" "}
                          {statusConfig[nextStatus]?.label}
                        </button>
                      )}

                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          onClick={() => handleStatusChange(order.id, "cancelled")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors ml-auto"
                        >
                          <AlertCircle className="w-4 h-4" />
                          Cancelar
                        </button>
                      )}

                      {order.status === "delivered" && (
                        <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium ml-auto">
                          <CheckCircle2 className="w-4 h-4" />
                          Concluído
                        </span>
                      )}
                    </div>

                    {/* Seletor manual de status */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <span className="text-xs text-muted-foreground">Status manual:</span>
                      <Select
                        value={order.status}
                        onValueChange={(v) => handleStatusChange(order.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
