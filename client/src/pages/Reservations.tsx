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
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Phone,
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

export default function Reservations() {
  const utils = trpc.useUtils();
  const { data: reservations, isLoading } = trpc.reservations.list.useQuery();

  const updateStatus = trpc.reservations.updateStatus.useMutation({
    onSuccess: () => {
      utils.reservations.list.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const pendingCount = reservations?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Reservas
            {pendingCount > 0 && (
              <span className="ml-1 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie as reservas de mesa do restaurante
          </p>
        </div>
      </div>

      {/* Contadores rápidos */}
      {!isLoading && reservations && reservations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const count = reservations.filter((r) => r.status === key).length;
            return (
              <div key={key} className={`rounded-xl p-3 ${cfg.bg} flex items-center gap-2`}>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
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

            return (
              <div
                key={reservation.id}
                className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  reservation.status === "pending"
                    ? "border-amber-300/60 ring-1 ring-amber-200"
                    : "border-border/50"
                }`}
              >
                {/* Barra de cor no topo */}
                <div className={`h-1 w-full ${status.dot}`} />

                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-primary" />
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

                  {/* Seletor de status */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Select
                      value={reservation.status}
                      onValueChange={(v) =>
                        updateStatus.mutate({ id: reservation.id, status: v as ReservationStatus })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs rounded-lg flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmada</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                      </SelectContent>
                    </Select>
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
