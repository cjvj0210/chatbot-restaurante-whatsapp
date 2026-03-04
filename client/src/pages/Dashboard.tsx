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
} from "lucide-react";
import { useLocation } from "wouter";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:    { label: "Pendente",    color: "bg-yellow-100 text-yellow-700",  icon: Clock },
  confirmed:  { label: "Confirmado",  color: "bg-blue-100 text-blue-700",      icon: Loader2 },
  preparing:  { label: "Preparando",  color: "bg-orange-100 text-orange-700",  icon: Loader2 },
  ready:      { label: "Pronto",      color: "bg-green-100 text-green-700",    icon: CheckCircle2 },
  delivered:  { label: "Entregue",    color: "bg-gray-100 text-gray-600",      icon: CheckCircle2 },
  cancelled:  { label: "Cancelado",   color: "bg-red-100 text-red-600",        icon: AlertCircle },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentOrders, isLoading: ordersLoading } = trpc.order.list.useQuery({ limit: 5 });

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
      label: "Pendentes",
      value: stats?.pendingOrders ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      sub: "Aguardando confirmação",
      alert: (stats?.pendingOrders ?? 0) > 0,
    },
    {
      label: "Reservas Ativas",
      value: stats?.activeReservations ?? 0,
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-50",
      sub: "Confirmadas",
    },
    {
      label: "Clientes",
      value: stats?.totalCustomers ?? 0,
      icon: Users,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      sub: "Cadastrados no sistema",
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
                className={`stat-card relative overflow-hidden ${kpi.alert ? "ring-2 ring-amber-400/50" : ""}`}
              >
                {kpi.alert && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                )}
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left group"
              >
                <div className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center shrink-0`}>
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.sub}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
