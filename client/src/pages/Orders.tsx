import { useState, useEffect, useRef, memo } from "react";
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
  Truck,
  MapPin,
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  History,
  Phone,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AUTO_ACCEPT_KEY = "estreladosul_auto_accept";

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: "Pendente",    bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400" },
  confirmed:  { label: "Confirmado",  bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500" },
  preparing:  { label: "Preparando",  bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500" },
  ready:      { label: "Pronto",      bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500" },
  delivering: { label: "A Caminho",   bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500" },
  delivered:  { label: "Entregue",    bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400" },
  cancelled:  { label: "Cancelado",   bg: "bg-red-50",     text: "text-red-600",    dot: "bg-red-500" },
};

// Fluxo simplificado: pending → confirmed (auto) → delivering (botão único) → delivered (auto após confirmar entrega)
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

// Gera um beep sintético usando Web Audio API (sem arquivo externo)
function playAlertBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.30);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch (_) { /* silently ignore if audio not available */ }
}

// Abre janela de impressão automaticamente (para impressora térmica)
function autoPrint(orderId: number) {
  const url = `/print-order/${orderId}`;
  const win = window.open(url, `print_${orderId}`, "width=400,height=600,menubar=no,toolbar=no,status=no");
  if (!win) {
    // Se popup bloqueado, abre em nova aba normalmente
    window.open(url, "_blank");
  }
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

export default function Orders() {
  const utils = trpc.useUtils();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(0);
  const PAGE_SIZE = 20;
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  const prevPendingCount = useRef<number>(0);
  const isFirstLoad = useRef<boolean>(true);
  const autoAcceptedIds = useRef<Set<number>>(new Set());

  // Configuração de aceite automático (persiste no localStorage)
  const [autoAccept, setAutoAccept] = useState<boolean>(() => {
    return localStorage.getItem(AUTO_ACCEPT_KEY) === "true";
  });

  const toggleAutoAccept = () => {
    const next = !autoAccept;
    setAutoAccept(next);
    localStorage.setItem(AUTO_ACCEPT_KEY, next ? "true" : "false");
    toast.success(next ? "✅ Aceite automático ativado" : "⏸️ Aceite automático desativado");
  };

  type StatusEnum = "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";
  const queryInput = {
    ...(filterStatus !== "all" ? { status: filterStatus as StatusEnum } : {}),
    ...(filterDateFrom ? { dateFrom: filterDateFrom } : {}),
    ...(filterDateTo ? { dateTo: filterDateTo } : {}),
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
  };
  const hasFilters = Object.keys(queryInput).length > 2; // tem mais que limit+offset
  const { data: orders, isLoading, isError, refetch } = trpc.order.list.useQuery(
    Object.keys(queryInput).length > 2 || currentPage > 0 ? queryInput : undefined
  );

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      utils.order.list.invalidate();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatus.mutate({ orderId, status: newStatus as StatusEnum });
  };

  const pendingCount = orders?.filter((o) => o.status === "pending").length ?? 0;

  // Aceite automático: quando chega pedido novo, aceita e imprime automaticamente
  useEffect(() => {
    if (isFirstLoad.current) {
      if (!isLoading && orders !== undefined) {
        // Na primeira carga, registra todos os pendentes como já conhecidos (não aceita automaticamente)
        orders.filter((o) => o.status === "pending").forEach((o) => autoAcceptedIds.current.add(o.id));
        prevPendingCount.current = pendingCount;
        isFirstLoad.current = false;
      }
      return;
    }

    if (!orders) return;

    const pendingOrders = orders.filter((o) => o.status === "pending");
    const newOrders = pendingOrders.filter((o) => !autoAcceptedIds.current.has(o.id));

    if (newOrders.length > 0) {
      // Alerta sonoro duplo
      playAlertBeep();
      setTimeout(playAlertBeep, 700);

      if (autoAccept) {
        // Aceite automático: confirma e imprime cada novo pedido
        newOrders.forEach((order) => {
          autoAcceptedIds.current.add(order.id);
          updateStatus.mutate(
            { orderId: order.id, status: "confirmed" },
            {
              onSuccess: () => {
                utils.order.list.invalidate();
                toast.success(`🖨️ Pedido #${order.orderNumber} aceito e enviado para impressão!`, { duration: 5000 });
                // Impressão automática após aceite
                setTimeout(() => autoPrint(order.id), 800);
              },
            }
          );
        });
      } else {
        // Só alerta, sem aceitar
        newOrders.forEach((o) => autoAcceptedIds.current.add(o.id));
        toast.warning(`🔔 ${newOrders.length} novo(s) pedido(s) aguardando aceite!`, { duration: 8000 });
      }
    }

    prevPendingCount.current = pendingCount;
  }, [orders, isLoading]);

  // Refetch automático a cada 15 segundos para detectar novos pedidos
  useEffect(() => {
    const interval = setInterval(() => {
      utils.order.list.invalidate();
    }, 15000);
    return () => clearInterval(interval);
  }, [utils]);

  return (
    <div className="space-y-5 max-w-5xl">
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
            Gerencie e acompanhe todos os pedidos
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle aceite automático */}
          <button
            onClick={toggleAutoAccept}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
              autoAccept
                ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-200"
                : "bg-card text-muted-foreground border-border/60 hover:border-green-400 hover:text-green-700"
            }`}
          >
            <Zap className={`w-4 h-4 ${autoAccept ? "fill-white" : ""}`} />
            {autoAccept ? "Auto-aceite ON" : "Auto-aceite OFF"}
          </button>

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(0); }}>
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
            {/* Filtro de data */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(0); }}
                className="h-9 px-2 text-sm rounded-xl border border-border/60 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                title="Data inicial"
              />
              <span className="text-muted-foreground text-xs">até</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(0); }}
                className="h-9 px-2 text-sm rounded-xl border border-border/60 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                title="Data final"
              />
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setCurrentPage(0); }}
                  className="h-9 px-2 text-xs rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="Limpar filtro de data"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Banner informativo quando auto-aceite está ativo */}
      {autoAccept && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-sm text-green-800">
          <Zap className="w-4 h-4 text-green-600 fill-green-600 shrink-0" />
          <span>
            <strong>Aceite automático ativo:</strong> novos pedidos são confirmados e impressos automaticamente assim que chegam.
          </span>
        </div>
      )}

      {/* Estado de erro */}
      {isError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-2">
          <p className="text-sm text-red-700 font-medium">Erro ao carregar pedidos. Verifique sua conexão.</p>
          <button
            onClick={() => refetch()}
            className="text-xs text-red-600 underline hover:text-red-800 font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      )}

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
            const items: OrderItem[] = (() => {
              if ((order as any).orderItemsList && (order as any).orderItemsList.length > 0) {
                return (order as any).orderItemsList;
              }
              try { return JSON.parse(order.items); } catch { return []; }
            })();

            // Lógica simplificada de botões:
            // pending → botão "Aceitar Pedido" (verde pulsante)
            // confirmed/preparing/ready → botão "Pedido a Caminho" (azul) — marca como delivering
            // delivering → botão "Confirmar Entrega" (verde) — marca como delivered
            // delivered/cancelled → sem botão de avanço
            const isPending = order.status === "pending";
            const isActive = ["confirmed", "preparing", "ready"].includes(order.status);
            const isDelivering = order.status === "delivering";
            const isDelivery = order.orderType === "delivery";
            const isDone = order.status === "delivered" || order.status === "cancelled";

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
                    {/* Botão histórico do cliente */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryPhone(historyPhone === order.customerPhone ? null : order.customerPhone)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        {historyPhone === order.customerPhone ? "Ocultar histórico" : "Ver histórico do cliente"}
                      </button>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {order.customerPhone}
                      </span>
                    </div>
                    {/* Histórico de pedidos do cliente */}
                    {historyPhone === order.customerPhone && (
                      <CustomerHistory phone={order.customerPhone} currentOrderId={order.id} />
                    )}

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
                        <span className="font-semibold">Obs: </span>
                        {order.customerNotes}
                      </div>
                    )}

                    {/* ===== AÇÕES SIMPLIFICADAS ===== */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {/* Botão imprimir — sempre disponível */}
                      <button
                        onClick={() => autoPrint(order.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir
                      </button>

                      {/* Pedido PENDENTE → Aceitar */}
                      {isPending && (
                        <button
                          onClick={() => {
                            handleStatusChange(order.id, "confirmed");
                            toast.success(`✅ Pedido #${order.orderNumber} aceito!`);
                            setTimeout(() => autoPrint(order.id), 600);
                          }}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow-md ring-2 ring-green-300 animate-pulse transition-colors disabled:opacity-60"
                        >
                          {updateStatus.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          ✅ Aceitar Pedido
                        </button>
                      )}

                      {/* Pedido ATIVO (confirmed/preparing/ready) → Pedido a Caminho (só para delivery) */}
                      {isActive && isDelivery && (
                        <button
                          onClick={() => {
                            handleStatusChange(order.id, "delivering");
                            toast.success(`🛵 Pedido #${order.orderNumber} saiu para entrega!`);
                          }}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60"
                        >
                          {updateStatus.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Truck className="w-4 h-4" />
                          )}
                          🛵 Pedido a Caminho
                        </button>
                      )}

                      {/* Pedido ATIVO (retirada) → Pronto para retirar */}
                      {isActive && !isDelivery && (
                        <button
                          onClick={() => {
                            handleStatusChange(order.id, "delivered");
                            toast.success(`✅ Pedido #${order.orderNumber} retirado!`);
                          }}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60"
                        >
                          {updateStatus.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          ✅ Retirado pelo Cliente
                        </button>
                      )}

                      {/* Pedido A CAMINHO → Confirmar Entrega */}
                      {isDelivering && (
                        <button
                          onClick={() => {
                            handleStatusChange(order.id, "delivered");
                            toast.success(`✅ Pedido #${order.orderNumber} entregue!`);
                          }}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors disabled:opacity-60"
                        >
                          {updateStatus.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          ✅ Confirmar Entrega
                        </button>
                      )}

                      {/* Pedido CONCLUÍDO */}
                      {order.status === "delivered" && (
                        <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Entregue
                        </span>
                      )}

                      {/* Cancelar — sempre disponível enquanto não concluído/cancelado */}
                      {!isDone && (
                        <button
                          onClick={() => handleStatusChange(order.id, "cancelled")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors ml-auto"
                        >
                          <AlertCircle className="w-4 h-4" />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
            })}
        </div>
      )}

      {/* Controles de paginação */}
      {!isLoading && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {orders && orders.length > 0
              ? `Página ${currentPage + 1} · ${orders.length} pedido${orders.length !== 1 ? "s" : ""}`
              : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="h-9 px-4 text-sm rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <span className="text-sm font-medium text-foreground px-2">{currentPage + 1}</span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!orders || orders.length < PAGE_SIZE}
              className="h-9 px-4 text-sm rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
