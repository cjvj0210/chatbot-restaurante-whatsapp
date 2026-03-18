import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Phone,
  Bell,
  History,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays, subDays, isToday, isTomorrow, isYesterday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string; icon: React.ElementType }> = {
  pending:   { label: "Pendente",   bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400",  icon: Clock },
  confirmed: { label: "Confirmada", bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  icon: CheckCircle2 },
  cancelled: { label: "Cancelada",  bg: "bg-red-50",    text: "text-red-600",    dot: "bg-red-500",    icon: XCircle },
  completed: { label: "Concluída",  bg: "bg-gray-100",  text: "text-gray-600",   dot: "bg-gray-400",   icon: CheckCircle2 },
};

type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

// Gera um beep sintético usando Web Audio API
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
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) { /* silently ignore */ }
}

function getDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  if (isYesterday(d)) return "Ontem";
  return format(d, "EEEE, dd 'de' MMM", { locale: ptBR });
}

export default function Reservations() {
  const utils = trpc.useUtils();

  // Estado de filtros
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showHistory, setShowHistory] = useState(false);

  // Query com filtros
  const queryInput = useMemo(() => ({
    ...(showHistory ? {} : { date: selectedDate }),
    ...(filterStatus !== "all" ? { status: filterStatus as ReservationStatus } : {}),
    showHistory,
  }), [selectedDate, filterStatus, showHistory]);

  const { data: reservations, isLoading, isError, refetch } = trpc.reservations.list.useQuery(queryInput);

  const isFirstLoad = useRef<boolean>(true);
  const knownIds = useRef<Set<number>>(new Set());

  const updateStatus = trpc.reservations.updateStatus.useMutation({
    onSuccess: () => {
      utils.reservations.list.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const pendingCount = reservations?.filter((r: any) => r.status === "pending").length ?? 0;
  const [soundMuted, setSoundMuted] = useState(false);
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Som contínuo enquanto houver reservas pendentes
  const stopAlertSound = useCallback(() => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
  }, []);

  const startAlertSound = useCallback(() => {
    if (alertIntervalRef.current) return; // já tocando
    playAlertBeep();
    alertIntervalRef.current = setInterval(() => {
      playAlertBeep();
    }, 4000); // toca a cada 4 segundos
  }, []);

  // Controlar som baseado em pendentes e mute
  useEffect(() => {
    if (pendingCount > 0 && !soundMuted) {
      startAlertSound();
    } else {
      stopAlertSound();
    }
    return () => stopAlertSound();
  }, [pendingCount, soundMuted, startAlertSound, stopAlertSound]);

  // Detectar novas reservas pendentes e emitir toast
  useEffect(() => {
    if (!reservations) return;
    const pending = reservations.filter((r: any) => r.status === "pending");
    if (isFirstLoad.current) {
      pending.forEach((r: any) => knownIds.current.add(r.id));
      isFirstLoad.current = false;
      return;
    }
    const newOnes = pending.filter((r: any) => !knownIds.current.has(r.id));
    if (newOnes.length > 0) {
      newOnes.forEach((r: any) => knownIds.current.add(r.id));
      toast.warning(`📅 ${newOnes.length} nova(s) reserva(s) chegaram!`, { duration: 8000 });
    }
  }, [reservations]);

  // Refetch automático a cada 15 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      utils.reservations.list.invalidate();
    }, 15000);
    return () => clearInterval(interval);
  }, [utils]);

  // Navegação de datas
  const goToPrevDay = () => setSelectedDate(format(subDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"));
  const goToNextDay = () => setSelectedDate(format(addDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"));
  const goToToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  // Contadores
  const counts = useMemo(() => {
    if (!reservations) return { pending: 0, confirmed: 0, cancelled: 0, completed: 0, total: 0 };
    return {
      pending: reservations.filter((r: any) => r.status === "pending").length,
      confirmed: reservations.filter((r: any) => r.status === "confirmed").length,
      cancelled: reservations.filter((r: any) => r.status === "cancelled").length,
      completed: reservations.filter((r: any) => r.status === "completed").length,
      total: reservations.length,
    };
  }, [reservations]);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Reservas
            {pendingCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {showHistory ? "Histórico completo de reservas" : `Reservas para ${getDateLabel(selectedDate)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Silenciar/Ativar som */}
          {pendingCount > 0 && (
            <button
              onClick={() => setSoundMuted(!soundMuted)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                soundMuted
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              }`}
              title={soundMuted ? "Ativar som" : "Silenciar som"}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {soundMuted ? "Mudo" : "Som"}
            </button>
          )}

        {/* Botão Histórico */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
            showHistory
              ? "bg-primary text-white border-primary shadow-md"
              : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {showHistory ? <EyeOff className="w-4 h-4" /> : <History className="w-4 h-4" />}
          {showHistory ? "Voltar às Ativas" : "Ver Histórico"}
        </button>
        </div>
      </div>

      {/* Seletor de Data (só quando não está em modo histórico) */}
      {!showHistory && (
        <div className="flex items-center gap-3 bg-card rounded-2xl border border-border/50 p-3">
          <button
            onClick={goToPrevDay}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 px-3 text-sm rounded-xl border border-border/60 bg-background text-foreground"
            />
            <span className="text-sm font-semibold text-foreground capitalize">
              {getDateLabel(selectedDate)}
            </span>
            {selectedDate !== format(new Date(), "yyyy-MM-dd") && (
              <button
                onClick={goToToday}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Hoje
              </button>
            )}
          </div>

          <button
            onClick={goToNextDay}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filtro por status (modo histórico) */}
      {showHistory && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 px-3 text-sm rounded-xl border border-border/60 bg-background text-foreground"
          >
            <option value="all">Todos os status</option>
            {Object.entries(statusConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 px-3 text-sm rounded-xl border border-border/60 bg-background text-foreground"
          />
        </div>
      )}

      {/* Banner de alerta para reservas pendentes */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-4 bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shrink-0 animate-bounce">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-red-700 text-sm">
              {pendingCount} reserva{pendingCount > 1 ? "s" : ""} aguardando confirmação!
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Confirme ou cancele abaixo para o cliente receber a notificação
            </p>
          </div>
        </div>
      )}

      {/* Estado de erro */}
      {isError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 font-medium">Erro ao carregar reservas. Verifique sua conexão.</p>
          <button
            onClick={() => refetch()}
            className="text-xs text-red-600 underline hover:text-red-800 font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Contadores rápidos */}
      {!isLoading && reservations && reservations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const count = reservations.filter((r: any) => r.status === key).length;
            return (
              <div key={key} className={`rounded-xl p-3 ${cfg.bg} flex items-center gap-2`}>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ${key === "pending" && count > 0 ? "animate-ping" : ""}`} />
                <div>
                  <p className={`text-lg font-bold ${cfg.text}`}>{count}</p>
                  <p className={`text-xs ${cfg.text} opacity-80`}>{cfg.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de reservas */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-1.5" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : !reservations?.length ? (
        <div className="bg-card rounded-2xl border border-border/50 py-16 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">
            {showHistory ? "Nenhuma reserva encontrada" : `Nenhuma reserva para ${getDateLabel(selectedDate)}`}
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {showHistory
              ? "Tente ajustar os filtros acima"
              : "As reservas feitas pelo chatbot aparecerão aqui"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reservations.map((reservation: any) => {
            const status = statusConfig[reservation.status] ?? statusConfig.pending;
            const StatusIcon = status.icon;
            const reservationDate = new Date(reservation.date);
            const isPending = reservation.status === "pending";
            const isConfirmed = reservation.status === "confirmed";

            return (
              <div
                key={reservation.id}
                className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  isPending
                    ? "border-red-300/80 ring-2 ring-red-200"
                    : "border-border/50"
                }`}
              >
                {/* Barra de cor no topo */}
                <div className={`h-1.5 w-full ${status.dot} ${isPending ? "animate-pulse" : ""}`} />

                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPending ? "bg-red-100" : "bg-primary/10"
                      }`}>
                        <Calendar className={`w-5 h-5 ${isPending ? "text-red-500" : "text-primary"}`} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">
                          #{reservation.reservationNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Criada em {format(new Date(reservation.createdAt), "dd/MM 'às' HH:mm")}
                        </p>
                      </div>
                    </div>
                    <span className={`status-badge ${status.bg} ${status.text}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>

                  {/* Informações da reserva */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">Data e Hora</p>
                      <p className="text-sm font-semibold text-foreground">
                        {format(reservationDate, "dd 'de' MMM", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(reservationDate, "HH:mm")} ·{" "}
                        {format(reservationDate, "EEEE", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">Pessoas</p>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        {reservation.numberOfPeople} pessoas
                      </p>
                    </div>
                  </div>

                  {/* Contato */}
                  {(reservation.customerName || reservation.customerPhone) && (
                    <div className="flex items-center gap-3 text-sm">
                      {reservation.customerName && (
                        <span className="font-medium text-foreground">{reservation.customerName}</span>
                      )}
                      {reservation.customerPhone && (
                        <a
                          href={`https://wa.me/55${reservation.customerPhone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-medium"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {reservation.customerPhone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Observações */}
                  {reservation.customerNotes && (
                    <div className="flex items-start gap-2 text-muted-foreground bg-orange-50 rounded-xl px-3 py-2">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-500" />
                      <span className="text-xs text-orange-700">{reservation.customerNotes}</span>
                    </div>
                  )}

                  {/* ===== AÇÕES ===== */}
                  <div className="pt-1 border-t border-border/40 space-y-2">
                    {/* Reserva PENDENTE → Confirmar ou Cancelar */}
                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus.mutate({ id: reservation.id, status: "confirmed" })}
                          disabled={updateStatus.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow-md ring-2 ring-green-300 animate-pulse transition-colors disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmar Reserva
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ id: reservation.id, status: "cancelled" })}
                          disabled={updateStatus.isPending}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Reserva CONFIRMADA → Marcar como Concluída */}
                    {isConfirmed && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus.mutate({ id: reservation.id, status: "completed" })}
                          disabled={updateStatus.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Marcar como Concluída
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ id: reservation.id, status: "cancelled" })}
                          disabled={updateStatus.isPending}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Reserva CONCLUÍDA ou CANCELADA → só exibe status */}
                    {(reservation.status === "completed" || reservation.status === "cancelled") && (
                      <p className={`text-xs font-medium text-center py-1 ${status.text}`}>
                        {reservation.status === "completed" ? "✅ Reserva concluída" : "❌ Reserva cancelada"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
