import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) { /* silently ignore */ }
}

export default function Reservations() {
  const utils = trpc.useUtils();
  const { data: reservations, isLoading } = trpc.reservations.list.useQuery();

  const isFirstLoad = useRef<boolean>(true);
  const knownIds = useRef<Set<number>>(new Set());

  const updateStatus = trpc.reservations.updateStatus.useMutation({
    onSuccess: () => {
      utils.reservations.list.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const pendingCount = reservations?.filter((r) => r.status === "pending").length ?? 0;

  // Detectar novas reservas pendentes e emitir alerta sonoro
  useEffect(() => {
    if (!reservations) return;
    const pending = reservations.filter((r) => r.status === "pending");
    if (isFirstLoad.current) {
      pending.forEach((r) => knownIds.current.add(r.id));
      isFirstLoad.current = false;
      return;
    }
    const newOnes = pending.filter((r) => !knownIds.current.has(r.id));
    if (newOnes.length > 0) {
      playAlertBeep();
      setTimeout(playAlertBeep, 600);
      newOnes.forEach((r) => knownIds.current.add(r.id));
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

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            Gerencie as reservas de mesa do restaurante
          </p>
        </div>
      </div>

      {/* Banner de alerta para reservas pendentes */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-4 bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shrink-0 animate-bounce">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-red-700 text-sm">
              🔔 {pendingCount} reserva{pendingCount > 1 ? "s" : ""} aguardando confirmação!
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Confirme ou cancele abaixo para o cliente receber a notificação
            </p>
          </div>
        </div>
      )}

      {/* Contadores rápidos */}
      {!isLoading && reservations && reservations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const count = reservations.filter((r) => r.status === key).length;
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
          <p className="font-semibold text-muted-foreground">Nenhuma reserva ainda</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            As reservas feitas pelo chatbot aparecerão aqui
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reservations.map((reservation) => {
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
                    <div className="flex items-start gap-2 bg-orange-50 rounded-xl px-3 py-2 text-sm text-orange-700">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span className="text-xs">{reservation.customerNotes}</span>
                    </div>
                  )}

                  {/* ===== AÇÕES SIMPLIFICADAS ===== */}
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
                          ✅ Confirmar Reserva
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
