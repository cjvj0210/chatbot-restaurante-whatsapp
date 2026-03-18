import { useState, useEffect, useRef, useCallback, memo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Printer,
  Truck,
  MapPin,
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  History,
  Phone,
  Volume2,
  VolumeX,
  ArrowRight,
  XCircle,
  Columns3,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AUTO_ACCEPT_KEY = "estreladosul_auto_accept";
const VIEW_MODE_KEY = "estreladosul_orders_view";

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: "Pendente",    bg: "bg-amber-50",   text: "text-amber-900",  dot: "bg-amber-400" },
  confirmed:  { label: "Aceito",      bg: "bg-blue-50",    text: "text-blue-900",   dot: "bg-blue-500" },
  preparing:  { label: "Preparando",  bg: "bg-orange-50",  text: "text-orange-900", dot: "bg-orange-500" },
  ready:      { label: "Pronto",      bg: "bg-green-50",   text: "text-green-900",  dot: "bg-green-500" },
  delivering: { label: "A Caminho",   bg: "bg-indigo-50",  text: "text-indigo-900", dot: "bg-indigo-500" },
  delivered:  { label: "Entregue",    bg: "bg-gray-100",   text: "text-gray-900",   dot: "bg-gray-400" },
  cancelled:  { label: "Cancelado",   bg: "bg-red-50",     text: "text-red-900",    dot: "bg-red-500" },
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

// ===== SOM CONTÍNUO DE ALERTA =====
// Toca beep repetidamente até ser parado
class AlertSoundManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  private beep() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.30);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.55);
    } catch (_) { /* silently ignore */ }
  }

  start() {
    if (this.intervalId) return; // já tocando
    this.beep(); // toca imediatamente
    this.intervalId = setInterval(() => this.beep(), 2500); // repete a cada 2.5s
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  get isPlaying() {
    return this.intervalId !== null;
  }
}

const alertSound = new AlertSoundManager();

// Abre janela de impressão automaticamente
function autoPrint(orderId: number) {
  const url = `/print-order/${orderId}`;
  const win = window.open(url, `print_${orderId}`, "width=400,height=600,menubar=no,toolbar=no,status=no");
  if (!win) window.open(url, "_blank");
}

// Componente de histórico de pedidos por cliente
const CustomerHistory = memo(function CustomerHistory({ phone, currentOrderId }: { phone: string; currentOrderId: number }) {
  const { data: history, isLoading } = trpc.order.getByPhone.useQuery(
    { phone },
    { enabled: !!phone }
  );

  if (isLoading) {
    return (
      <div className="bg-muted/20 rounded-xl p-3 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  const otherOrders = history?.filter((o) => o.id !== currentOrderId) ?? [];
  const totalSpent = history?.reduce((sum, o) => sum + o.total, 0) ?? 0;

  return (
    <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          Histórico do cliente
        </p>
        <div className="flex gap-3 text-xs text-blue-600">
          <span className="font-semibold">{history?.length ?? 0} pedido{(history?.length ?? 0) !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span className="font-semibold">R$ {(totalSpent / 100).toFixed(2).replace(".", ",")} total</span>
        </div>
      </div>
      {otherOrders.length === 0 ? (
        <p className="text-xs text-blue-500 italic">Este é o primeiro pedido deste cliente.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {otherOrders.map((o) => {
            const sc = statusConfig[o.status] ?? statusConfig.pending;
            const itemsList = (o as any).orderItemsList ?? [];
            return (
              <div key={o.id} className="bg-white rounded-xl p-3 border border-blue-100 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-700">#{o.orderNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>{sc.label}</span>
                </div>
                <p className="text-gray-500">{format(new Date(o.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                {itemsList.length > 0 && (
                  <p className="text-gray-600 mt-1">{itemsList.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}</p>
                )}
                <p className="font-bold text-gray-800 mt-1">R$ {(o.total / 100).toFixed(2).replace(".", ",")}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ===== CARD DE PEDIDO (reutilizado em ambas as views) =====
function OrderCard({
  order,
  isExpanded,
  onToggle,
  onStatusChange,
  isUpdating,
  historyPhone,
  onToggleHistory,
  compact = false,
}: {
  order: any;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (orderId: number, status: string) => void;
  isUpdating: boolean;
  historyPhone: string | null;
  onToggleHistory: (phone: string) => void;
  compact?: boolean;
}) {
  const status = statusConfig[order.status] ?? statusConfig.pending;
  const items: OrderItem[] = (() => {
    if ((order as any).orderItemsList && (order as any).orderItemsList.length > 0) {
      return (order as any).orderItemsList;
    }
    try { return JSON.parse(order.items); } catch { return []; }
  })();

  const isPending = order.status === "pending";
  const isActive = ["confirmed", "preparing", "ready"].includes(order.status);
  const isDelivering = order.status === "delivering";
  const isDelivery = order.orderType === "delivery";
  const isDone = order.status === "delivered" || order.status === "cancelled";

  return (
    <div
      className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all ${
        isPending ? "border-amber-300/60 ring-1 ring-amber-200" : "border-border/50"
      }`}
    >
      {/* Barra de progresso */}
      <div className="h-1 w-full bg-muted">
        <div
          className={`h-full transition-all ${status.dot}`}
          style={{ width: `${((statusFlow.indexOf(order.status) + 1) / statusFlow.length) * 100}%` }}
        />
      </div>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className={`w-8 h-8 ${compact ? "w-7 h-7" : ""} bg-primary/10 rounded-lg flex items-center justify-center shrink-0`}>
          {isDelivery ? <MapPin className="w-4 h-4 text-primary" /> : <Store className="w-4 h-4 text-primary" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-foreground text-sm">#{order.orderNumber}</p>
            <span className="text-muted-foreground/40">·</span>
            <p className="font-semibold text-foreground text-sm truncate">{order.customerName}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(order.createdAt), "HH:mm", { locale: ptBR })} ·{" "}
            {isDelivery ? "Delivery" : "Retirada"} ·{" "}
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
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Detalhes expandidos */}
      {isExpanded && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {/* Histórico */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleHistory(order.customerPhone)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              {historyPhone === order.customerPhone ? "Ocultar histórico" : "Ver histórico"}
            </button>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {order.customerPhone}
            </span>
          </div>
          {historyPhone === order.customerPhone && (
            <CustomerHistory phone={order.customerPhone} currentOrderId={order.id} />
          )}

          {/* Itens */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Itens do Pedido</p>
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium text-foreground">{item.quantity}x {item.name}</span>
                    {item.observations && <p className="text-xs text-orange-500 italic">Obs: {item.observations}</p>}
                  </div>
                  <span className="text-muted-foreground">R$ {((item.price * item.quantity) / 100).toFixed(2)}</span>
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
            {order.paymentMethod && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Pagamento</span>
                <span className="capitalize font-medium">{order.paymentMethod}</span>
              </div>
            )}
            {order.changeFor && order.changeFor > 0 && (
              <div className="flex justify-between text-xs text-amber-700 font-semibold">
                <span>Troco para</span>
                <span>R$ {(order.changeFor / 100).toFixed(2)}</span>
              </div>
            )}
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
              <span className="font-semibold">Obs: </span>{order.customerNotes}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={() => autoPrint(order.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>

            {isPending && (
              <button
                onClick={() => {
                  onStatusChange(order.id, "confirmed");
                  toast.success(`Pedido #${order.orderNumber} aceito!`);
                  setTimeout(() => autoPrint(order.id), 600);
                }}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow-md ring-2 ring-green-300 animate-pulse transition-colors disabled:opacity-60"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aceitar Pedido
              </button>
            )}

            {isActive && isDelivery && (
              <button
                onClick={() => {
                  onStatusChange(order.id, "delivering");
                  toast.success(`Pedido #${order.orderNumber} saiu para entrega!`);
                }}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Pedido a Caminho
              </button>
            )}

            {isActive && !isDelivery && (
              <button
                onClick={() => {
                  onStatusChange(order.id, "delivered");
                  toast.success(`Pedido #${order.orderNumber} retirado!`);
                }}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Retirado pelo Cliente
              </button>
            )}

            {isDelivering && (
              <button
                onClick={() => {
                  onStatusChange(order.id, "delivered");
                  toast.success(`Pedido #${order.orderNumber} entregue!`);
                }}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors disabled:opacity-60"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar Entrega
              </button>
            )}

            {order.status === "delivered" && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Entregue
              </span>
            )}

            {!isDone && (
              <button
                onClick={() => onStatusChange(order.id, "cancelled")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors ml-auto"
              >
                <XCircle className="w-4 h-4" /> Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== COLUNA KANBAN =====
function KanbanColumn({
  title,
  icon: Icon,
  color,
  orders,
  expandedId,
  onToggle,
  onStatusChange,
  isUpdating,
  historyPhone,
  onToggleHistory,
  nextAction,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  orders: any[];
  expandedId: number | null;
  onToggle: (id: number) => void;
  onStatusChange: (orderId: number, status: string) => void;
  isUpdating: boolean;
  historyPhone: string | null;
  onToggleHistory: (phone: string) => void;
  nextAction?: { label: string; status: string; color: string };
}) {
  return (
    <div className="flex-1 min-w-[300px]">
      <div className={`flex items-center gap-2 mb-3 px-1`}>
        <Icon className={`w-5 h-5 ${color}`} />
        <h3 className="font-bold text-sm text-foreground">{title}</h3>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
          orders.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {orders.length}
        </span>
      </div>
      <div className="space-y-3 min-h-[200px]">
        {orders.length === 0 ? (
          <div className="bg-muted/20 rounded-2xl border border-dashed border-border/50 py-8 text-center">
            <p className="text-xs text-muted-foreground/60">Nenhum pedido</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id}>
              <OrderCard
                order={order}
                isExpanded={expandedId === order.id}
                onToggle={() => onToggle(order.id)}
                onStatusChange={onStatusChange}
                isUpdating={isUpdating}
                historyPhone={historyPhone}
                onToggleHistory={onToggleHistory}
                compact
              />
              {/* Botão rápido de mover para próximo status */}
              {nextAction && (
                <button
                  onClick={() => {
                    onStatusChange(order.id, nextAction.status);
                    toast.success(`Pedido #${order.orderNumber} movido!`);
                  }}
                  disabled={isUpdating}
                  className={`w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold ${nextAction.color} transition-colors disabled:opacity-60`}
                >
                  <ArrowRight className="w-3 h-3" />
                  {nextAction.label}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===== COMPONENTE PRINCIPAL =====
export default function Orders() {
  const utils = trpc.useUtils();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const prevPendingCount = useRef<number>(0);
  const isFirstLoad = useRef<boolean>(true);
  const autoAcceptedIds = useRef<Set<number>>(new Set());

  // View mode: kanban ou lista
  const [viewMode, setViewMode] = useState<"kanban" | "list">(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as "kanban" | "list") || "kanban";
  });

  // Filtros para modo lista
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(0);
  const PAGE_SIZE = 20;

  // Auto-aceite
  const [autoAccept, setAutoAccept] = useState<boolean>(() => {
    return localStorage.getItem(AUTO_ACCEPT_KEY) === "true";
  });

  const toggleAutoAccept = () => {
    const next = !autoAccept;
    setAutoAccept(next);
    localStorage.setItem(AUTO_ACCEPT_KEY, next ? "true" : "false");
    toast.success(next ? "Aceite automático ativado" : "Aceite automático desativado");
  };

  const toggleViewMode = () => {
    const next = viewMode === "kanban" ? "list" : "kanban";
    setViewMode(next);
    localStorage.setItem(VIEW_MODE_KEY, next);
  };

  // Query: busca pedidos do dia (para kanban) ou com filtros (para lista)
  const today = format(new Date(), "yyyy-MM-dd");

  type StatusEnum = "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";

  const listQueryInput = viewMode === "list" ? {
    ...(filterStatus !== "all" ? { status: filterStatus as StatusEnum } : {}),
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
  } : undefined;

  // Pedidos do dia para o kanban
  const kanbanQueryInput = viewMode === "kanban" ? {
    dateFrom: today,
    dateTo: today,
    limit: 200,
    offset: 0,
  } : undefined;

  const queryInput = viewMode === "kanban" ? kanbanQueryInput : listQueryInput;

  const { data: orders, isLoading, isError, refetch } = trpc.order.list.useQuery(queryInput);

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      utils.order.list.invalidate();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleStatusChange = useCallback((orderId: number, newStatus: string) => {
    updateStatus.mutate({ orderId, status: newStatus as StatusEnum });
  }, [updateStatus]);

  const pendingCount = orders?.filter((o) => o.status === "pending").length ?? 0;

  // ===== SOM CONTÍNUO para pedidos pendentes =====
  useEffect(() => {
    if (soundMuted || autoAccept) {
      alertSound.stop();
      return;
    }
    if (pendingCount > 0) {
      alertSound.start();
    } else {
      alertSound.stop();
    }
    return () => alertSound.stop();
  }, [pendingCount, soundMuted, autoAccept]);

  // Aceite automático
  useEffect(() => {
    if (isFirstLoad.current) {
      if (!isLoading && orders !== undefined) {
        orders.filter((o) => o.status === "pending").forEach((o) => autoAcceptedIds.current.add(o.id));
        prevPendingCount.current = pendingCount;
        isFirstLoad.current = false;
      }
      return;
    }

    if (!orders || !autoAccept) return;

    const pendingOrders = orders.filter((o) => o.status === "pending");
    const newOrders = pendingOrders.filter((o) => !autoAcceptedIds.current.has(o.id));

    if (newOrders.length > 0) {
      newOrders.forEach((order) => {
        autoAcceptedIds.current.add(order.id);
        updateStatus.mutate(
          { orderId: order.id, status: "confirmed" },
          {
            onSuccess: () => {
              utils.order.list.invalidate();
              toast.success(`Pedido #${order.orderNumber} aceito e enviado para impressão!`, { duration: 5000 });
              setTimeout(() => autoPrint(order.id), 800);
            },
          }
        );
      });
    }

    prevPendingCount.current = pendingCount;
  }, [orders, isLoading, autoAccept]);

  // Refetch a cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      utils.order.list.invalidate();
    }, 10000);
    return () => clearInterval(interval);
  }, [utils]);

  // Parar som ao desmontar
  useEffect(() => {
    return () => alertSound.stop();
  }, []);

  // Separar pedidos por coluna kanban
  const acceptedOrders = orders?.filter((o) => ["confirmed", "preparing", "ready"].includes(o.status)) ?? [];
  const expeditedOrders = orders?.filter((o) => o.status === "delivering") ?? [];
  const completedOrders = orders?.filter((o) => o.status === "delivered") ?? [];
  const pendingOrders = orders?.filter((o) => o.status === "pending") ?? [];
  const cancelledOrders = orders?.filter((o) => o.status === "cancelled") ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
            {viewMode === "kanban" ? `Pedidos de hoje (${format(new Date(), "dd/MM/yyyy")})` : "Todos os pedidos"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão silenciar som */}
          <button
            onClick={() => {
              setSoundMuted(!soundMuted);
              if (!soundMuted) alertSound.stop();
              toast.success(soundMuted ? "Som ativado" : "Som silenciado");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
              soundMuted
                ? "border-red-300 text-red-600 bg-red-50"
                : "border-border/60 text-muted-foreground hover:border-primary/40"
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {soundMuted ? "Mudo" : "Som"}
          </button>

          {/* Toggle auto-aceite */}
          <button
            onClick={toggleAutoAccept}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
              autoAccept
                ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-200"
                : "bg-card text-muted-foreground border-border/60 hover:border-green-400 hover:text-green-700"
            }`}
          >
            <Zap className={`w-4 h-4 ${autoAccept ? "fill-white" : ""}`} />
            {autoAccept ? "Auto ON" : "Auto OFF"}
          </button>

          {/* Toggle view mode */}
          <button
            onClick={toggleViewMode}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border-2 border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
          >
            {viewMode === "kanban" ? <List className="w-4 h-4" /> : <Columns3 className="w-4 h-4" />}
            {viewMode === "kanban" ? "Lista" : "Kanban"}
          </button>
        </div>
      </div>

      {/* Banner auto-aceite */}
      {autoAccept && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-sm text-green-800">
          <Zap className="w-4 h-4 text-green-600 fill-green-600 shrink-0" />
          <span>
            <strong>Aceite automático ativo:</strong> novos pedidos são confirmados e impressos automaticamente.
          </span>
        </div>
      )}

      {/* Banner de pedidos pendentes com som */}
      {pendingCount > 0 && !autoAccept && (
        <div className="flex items-center gap-4 bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-4 animate-pulse">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 animate-bounce">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-amber-800 text-sm">
              {pendingCount} pedido{pendingCount > 1 ? "s" : ""} aguardando aceite!
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {soundMuted ? "Som silenciado" : "O som toca até você aceitar ou silenciar"}
            </p>
          </div>
          {pendingOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => {
                handleStatusChange(order.id, "confirmed");
                toast.success(`Pedido #${order.orderNumber} aceito!`);
                setTimeout(() => autoPrint(order.id), 600);
              }}
              disabled={updateStatus.isPending}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow-md transition-colors disabled:opacity-60 shrink-0"
            >
              Aceitar #{order.orderNumber}
            </button>
          ))}
        </div>
      )}

      {/* Erro */}
      {isError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 font-medium">Erro ao carregar pedidos.</p>
          <button onClick={() => refetch()} className="text-xs text-red-600 underline hover:text-red-800 font-semibold">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : viewMode === "kanban" ? (
        /* ===== VISUALIZAÇÃO KANBAN ===== */
        <div>
          {/* Pedidos pendentes em destaque no topo */}
          {pendingOrders.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 px-1">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-foreground">Aguardando Aceite</h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
                  {pendingOrders.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isExpanded={expandedId === order.id}
                    onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    onStatusChange={handleStatusChange}
                    isUpdating={updateStatus.isPending}
                    historyPhone={historyPhone}
                    onToggleHistory={(phone) => setHistoryPhone(historyPhone === phone ? null : phone)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* 3 colunas Kanban */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KanbanColumn
              title="Aceitos / Preparando"
              icon={CheckCircle2}
              color="text-blue-500"
              orders={acceptedOrders}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              onStatusChange={handleStatusChange}
              isUpdating={updateStatus.isPending}
              historyPhone={historyPhone}
              onToggleHistory={(phone) => setHistoryPhone(historyPhone === phone ? null : phone)}
              nextAction={{
                label: "Expedir / A Caminho",
                status: "delivering",
                color: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
              }}
            />

            <KanbanColumn
              title="Expedidos / A Caminho"
              icon={Truck}
              color="text-indigo-500"
              orders={expeditedOrders}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              onStatusChange={handleStatusChange}
              isUpdating={updateStatus.isPending}
              historyPhone={historyPhone}
              onToggleHistory={(phone) => setHistoryPhone(historyPhone === phone ? null : phone)}
              nextAction={{
                label: "Confirmar Entrega",
                status: "delivered",
                color: "bg-green-100 text-green-700 hover:bg-green-200",
              }}
            />

            <KanbanColumn
              title="Concluídos"
              icon={CheckCircle2}
              color="text-green-500"
              orders={completedOrders}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              onStatusChange={handleStatusChange}
              isUpdating={updateStatus.isPending}
              historyPhone={historyPhone}
              onToggleHistory={(phone) => setHistoryPhone(historyPhone === phone ? null : phone)}
            />
          </div>

          {/* Cancelados (se houver) */}
          {cancelledOrders.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3 px-1">
                <XCircle className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-sm text-muted-foreground">Cancelados hoje</h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                  {cancelledOrders.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 opacity-60">
                {cancelledOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isExpanded={expandedId === order.id}
                    onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    onStatusChange={handleStatusChange}
                    isUpdating={updateStatus.isPending}
                    historyPhone={historyPhone}
                    onToggleHistory={(phone) => setHistoryPhone(historyPhone === phone ? null : phone)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* Vazio */}
          {(!orders || orders.length === 0) && (
            <div className="bg-card rounded-2xl border border-border/50 py-16 text-center">
              <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">Nenhum pedido hoje</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Os pedidos do dia aparecerão aqui</p>
            </div>
          )}
        </div>
      ) : (
        /* ===== VISUALIZAÇÃO LISTA (original) ===== */
        <div className="space-y-3 max-w-5xl">
          {/* Filtros de lista */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(0); }}
              className="h-9 px-3 text-sm rounded-xl border border-border/60 bg-background text-foreground"
            >
              <option value="all">Todos os status</option>
              {Object.entries(statusConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {!orders?.length ? (
            <div className="bg-card rounded-2xl border border-border/50 py-16 text-center">
              <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <>
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isExpanded={expandedId === order.id}
                  onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  onStatusChange={handleStatusChange}
                  isUpdating={updateStatus.isPending}
                  historyPhone={historyPhone}
                  onToggleHistory={(phone) => setHistoryPhone(historyPhone === phone ? null : phone)}
                />
              ))}

              {/* Paginação */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Página {currentPage + 1} · {orders.length} pedido{orders.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="h-9 px-4 text-sm rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-sm font-medium text-foreground px-2">{currentPage + 1}</span>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={!orders || orders.length < PAGE_SIZE}
                    className="h-9 px-4 text-sm rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
