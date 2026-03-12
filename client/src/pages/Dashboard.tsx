import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Users,
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
  UtensilsCrossed,
  Settings,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Flame,
  Bell,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:    { label: "Pendente",    color: "bg-yellow-100 text-yellow-700",  icon: Clock },
  confirmed:  { label: "Confirmado",  color: "bg-blue-100 text-blue-700",      icon: Loader2 },
  preparing:  { label: "Preparando",  color: "bg-orange-100 text-orange-700",  icon: Loader2 },
  ready:      { label: "Pronto",      color: "bg-green-100 text-green-700",    icon: CheckCircle2 },
  delivered:  { label: "Entregue",    color: "bg-gray-100 text-gray-600",      icon: CheckCircle2 },
  cancelled:  { label: "Cancelado",   color: "bg-red-100 text-red-600",        icon: AlertCircle },
};

// Gera um beep sintético usando Web Audio API
function playAlertBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) { /* silently ignore */ }
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentOrders, isLoading: ordersLoading } = trpc.order.list.useQuery({ limit: 5 });
  const { data: reservations } = trpc.reservations.list.useQuery();

  const prevPendingReservations = useRef<number>(-1);
  const isFirstLoad = useRef<boolean>(true);
  const knownReservationIds = useRef<Set<number>>(new Set());

  const pendingReservations = reservations?.filter((r) => r.status === "pending") ?? [];
  const pendingReservationCount = pendingReservations.length;

  // Detectar novas reservas pendentes e emitir alerta
  useEffect(() => {
    if (!reservations) return;

    if (isFirstLoad.current) {
      // Na primeira carga, registra todas as reservas pendentes como já conhecidas
      pendingReservations.forEach((r) => knownReservationIds.current.add(r.id));
      prevPendingReservations.current = pendingReservationCount;
      isFirstLoad.current = false;
      return;
    }

    const newReservations = pendingReservations.filter((r) => !knownReservationIds.current.has(r.id));
    if (newReservations.length > 0) {
      playAlertBeep();
      setTimeout(playAlertBeep, 600);
      newReservations.forEach((r) => knownReservationIds.current.add(r.id));
      toast.warning(
        `📅 ${newReservations.length} nova(s) reserva(s) pendente(s)! Acesse Reservas para confirmar.`,
        { duration: 10000, action: { label: "Ver Reservas", onClick: () => setLocation("/reservations") } }
      );
    }

    prevPendingReservations.current = pendingReservationCount;
  }, [reservations]);

  // Refetch automático a cada 15 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      utils.dashboard.stats.invalidate();
      utils.reservations.list.invalidate();
      utils.order.list.invalidate();
    }, 15000);
    return () => clearInterval(interval);
  }, [utils]);

  const kpis = [
    {
      label: "Pedidos Hoje",
      value: stats?.totalOrders ?? 0,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
      sub: "Total acumulado",
    },
    {
      label: "Receita Total",
      value: `R$ ${((stats?.totalRevenue ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      sub: "Faturamento acumulado",
    },
    {
      label: "Pedidos Pendentes",
      value: stats?.pendingOrders ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      sub: "Aguardando confirmação",
      alert: (stats?.pendingOrders ?? 0) > 0,
      alertColor: "ring-amber-400/50",
    },
    {
      label: "Reservas Pendentes",
      value: pendingReservationCount,
      icon: Calendar,
      color: pendingReservationCount > 0 ? "text-red-600" : "text-purple-600",
      bg: pendingReservationCount > 0 ? "bg-red-50" : "bg-purple-50",
      sub: pendingReservationCount > 0 ? "⚠️ Aguardando confirmação" : "Nenhuma pendente",
      alert: pendingReservationCount > 0,
      alertColor: "ring-red-400/60",
      onClick: () => setLocation("/reservations"),
    },
    {
      label: "Clientes",
      value: stats?.totalCustomers ?? 0,
      icon: Users,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      sub: "Cadastrados no sistema",
      onClick: () => setLocation("/customers"),
    },
    {
      label: "Avaliação Média",
      value: stats?.averageRating ? `${stats.averageRating.toFixed(1)} ★` : "—",
      icon: TrendingUp,
      color: "text-rose-600",
      bg: "bg-rose-50",
      sub: "De 5 estrelas",
    },
  ];

  const quickActions = [
    { icon: UtensilsCrossed, label: "Gerenciar Cardápio", sub: "Itens, categorias e preços", path: "/menu", color: "bg-orange-500" },
    { icon: Package, label: "Ver Pedidos", sub: "Acompanhar em tempo real", path: "/orders", color: "bg-blue-600" },
    { icon: Calendar, label: "Reservas", sub: "Gerenciar mesas", path: "/reservations", color: "bg-purple-600" },
    { icon: Smartphone, label: "Testar Bot", sub: "Simular conversa WhatsApp", path: "/simulator", color: "bg-green-600" },
    { icon: Settings, label: "Configurações", sub: "Restaurante e WhatsApp", path: "/settings", color: "bg-gray-600" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="w-6 h-6 text-primary" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão geral do restaurante em tempo real
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* Banner de alerta de reservas pendentes */}
      {pendingReservationCount > 0 && (
        <button
          onClick={() => setLocation("/reservations")}
          className="w-full flex items-center gap-4 bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4 text-left hover:bg-red-100 transition-colors group"
        >
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shrink-0 animate-bounce">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-700 text-sm">
              🔔 {pendingReservationCount} reserva{pendingReservationCount > 1 ? "s" : ""} aguardando confirmação!
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Clique aqui para ver e confirmar as reservas pendentes
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-red-500 group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="stat-card">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          : kpis.map((kpi) => (
              <div
                key={kpi.label}
                onClick={kpi.onClick}
                className={`stat-card relative overflow-hidden transition-all ${
                  kpi.alert ? `ring-2 ${kpi.alertColor}` : ""
                } ${kpi.onClick ? "cursor-pointer hover:shadow-md" : ""}`}
              >
                {kpi.alert && (
                  <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full animate-ping ${
                    kpi.alertColor?.includes("red") ? "bg-red-500" : "bg-amber-400"
                  }`} />
                )}
                {kpi.alert && (
                  <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                    kpi.alertColor?.includes("red") ? "bg-red-500" : "bg-amber-400"
                  }`} />
                )}
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${kpi.alert && kpi.alertColor?.includes("red") ? "text-red-600" : "text-foreground"}`}>
                  {kpi.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
              </div>
            ))}
      </div>

      {/* Pedidos recentes + Ações rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Pedidos recentes */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="font-semibold text-foreground text-sm">Pedidos Recentes</h2>
            <button
              onClick={() => setLocation("/orders")}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-border/40">
            {ordersLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-3.5 w-28 mb-1.5" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))
            ) : !recentOrders?.length ? (
              <div className="px-5 py-10 text-center">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum pedido ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Os pedidos aparecerão aqui quando chegarem
                </p>
              </div>
            ) : (
              recentOrders.map((order) => {
                const status = statusConfig[order.status] ?? statusConfig.pending;
                const StatusIcon = status.icon;
                return (
                  <div
                    key={order.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setLocation("/orders")}
                  >
                    <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {((order.total ?? 0) / 100).toFixed(2).replace(".", ",")} ·{" "}
                        {order.orderType === "delivery" ? "Delivery" : "Retirada"}
                      </p>
                    </div>
                    <span className={`status-badge ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h2 className="font-semibold text-foreground text-sm">Acesso Rápido</h2>
          </div>
          <div className="p-3 space-y-1">
            {quickActions.map((action) => (
              <button
                key={action.path}
                onClick={() => setLocation(action.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left group relative"
              >
                <div className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center shrink-0`}>
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.sub}</p>
                </div>
                {/* Badge de alerta para Reservas */}
                {action.path === "/reservations" && pendingReservationCount > 0 && (
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {pendingReservationCount}
                  </span>
                )}
                {/* Badge de alerta para Pedidos */}
                {action.path === "/orders" && (stats?.pendingOrders ?? 0) > 0 && (
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {stats?.pendingOrders}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
