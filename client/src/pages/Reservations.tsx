import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  confirmed: "bg-green-500",
  cancelled: "bg-red-500",
  completed: "bg-gray-500",
};

const statusLabels = {
  pending: "Pendente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Concluída",
};

export default function Reservations() {
  const utils = trpc.useUtils();
  const { data: reservations, isLoading } = trpc.reservations.list.useQuery();

  const updateStatus = trpc.reservations.updateStatus.useMutation({
    onSuccess: () => {
      utils.reservations.list.invalidate();
      toast.success("Status atualizado com sucesso!");
    },
  });

  const handleStatusChange = (reservationId: number, newStatus: keyof typeof statusLabels) => {
    updateStatus.mutate({ id: reservationId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Reservas</h1>
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
      <h1 className="text-3xl font-bold mb-6">Reservas</h1>

      {!reservations || reservations.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Nenhuma reserva realizada ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reservations.map((reservation) => (
            <Card key={reservation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">#{reservation.reservationNumber}</CardTitle>
                  <Badge className={statusColors[reservation.status]}>
                    {statusLabels[reservation.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Data e Horário:</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(reservation.date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Número de Pessoas:</p>
                    <p className="text-sm text-muted-foreground">{reservation.numberOfPeople} pessoas</p>
                  </div>

                  {reservation.customerNotes && (
                    <div>
                      <p className="text-sm font-medium">Observações:</p>
                      <p className="text-sm text-muted-foreground">{reservation.customerNotes}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <label className="text-sm font-medium block mb-2">Alterar Status:</label>
                    <Select
                      value={reservation.status}
                      onValueChange={(value) => handleStatusChange(reservation.id, value as keyof typeof statusLabels)}
                    >
                      <SelectTrigger>
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

                  <div className="text-xs text-muted-foreground pt-2">
                    Criada em: {format(new Date(reservation.createdAt), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
