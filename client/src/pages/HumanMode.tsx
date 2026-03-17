import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Headset,
  Bot,
  Phone,
  Clock,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Timer,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h ${diffMin % 60}min`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

function timeRemaining(until: Date | string | null): string {
  if (!until) return "Sem limite";
  const now = new Date();
  const d = new Date(until);
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return "Expirado";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min restantes`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ${diffMin % 60}min restantes`;
}

export default function HumanMode() {
  const utils = trpc.useUtils();
  const { data: conversations, isLoading } = trpc.humanMode.listActive.useQuery(undefined, {
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  const returnToBot = trpc.humanMode.returnToBot.useMutation({
    onSuccess: (data) => {
      toast.success("Bot reativado!", {
        description: data.message,
      });
      utils.humanMode.listActive.invalidate();
      setConfirmDialog(null);
    },
    onError: (error) => {
      toast.error("Erro ao devolver ao bot", {
        description: error.message,
      });
    },
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    conversationId: number;
    customerName: string | null;
    customerPhone: string;
  } | null>(null);

  const activeCount = conversations?.filter((c) => !c.isExpired).length ?? 0;
  const expiredCount = conversations?.filter((c) => c.isExpired).length ?? 0;
  const totalCount = conversations?.length ?? 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Headset className="w-6 h-6 text-primary" />
            Modo Humano
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conversas sendo atendidas por operadores humanos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => utils.humanMode.listActive.invalidate()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Em Atendimento
          </p>
          <p className="text-2xl font-bold text-amber-600">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Conversas ativas</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Expiradas
          </p>
          <p className="text-2xl font-bold text-red-500">{expiredCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Tempo esgotado</p>
        </div>
        <div className="stat-card hidden md:block">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Total
          </p>
          <p className="text-2xl font-bold">{totalCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Conversas em modo humano</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-3">
        <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium mb-1">Como funciona o Modo Humano?</p>
          <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed">
            Quando um operador responde pelo WhatsApp Business App, o bot pausa automaticamente por 30 minutos.
            Para reativar o bot, clique em "Devolver ao Bot" abaixo ou envie <strong>#bot</strong> na conversa do WhatsApp.
          </p>
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          ))
        ) : totalCount === 0 ? (
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-12 text-center">
            <Bot className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-60" />
            <p className="text-lg font-semibold text-foreground mb-1">
              Nenhuma conversa em modo humano
            </p>
            <p className="text-sm text-muted-foreground">
              O Gauchinho está atendendo todas as conversas automaticamente.
            </p>
          </div>
        ) : (
          conversations?.map((conv) => {
            const isExpired = conv.isExpired;
            return (
              <div
                key={conv.conversationId}
                className={`bg-card rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md ${
                  isExpired
                    ? "border-red-200 dark:border-red-800/50"
                    : "border-amber-200 dark:border-amber-800/50"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Info do cliente */}
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        isExpired
                          ? "bg-red-100 dark:bg-red-900/30"
                          : "bg-amber-100 dark:bg-amber-900/30"
                      }`}
                    >
                      <UserCheck
                        className={`w-6 h-6 ${
                          isExpired
                            ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-base">
                        {conv.customerName || "Cliente sem nome"}
                      </p>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-0.5">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatPhone(conv.customerPhone)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status e ações */}
                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isExpired ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertCircle className="w-3 h-3" />
                          Expirado
                        </Badge>
                      ) : (
                        <Badge className="gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-100">
                          <Timer className="w-3 h-3" />
                          {timeRemaining(conv.humanModeUntil)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(conv.updatedAt)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          conversationId: conv.conversationId,
                          customerName: conv.customerName,
                          customerPhone: conv.customerPhone,
                        })
                      }
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Bot className="w-4 h-4" />
                      Devolver ao Bot
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dialog de confirmação */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-green-600" />
              Devolver ao Bot
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja reativar o Gauchinho para{" "}
              <strong>{confirmDialog?.customerName || "este cliente"}</strong> (
              {confirmDialog?.customerPhone ? formatPhone(confirmDialog.customerPhone) : ""})?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            O bot vai retomar a conversa automaticamente, respondendo a mensagem pendente do cliente
            e respeitando tudo que foi combinado pelo atendente humano.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (confirmDialog) {
                  returnToBot.mutate({
                    conversationId: confirmDialog.conversationId,
                    customerPhone: confirmDialog.customerPhone,
                  });
                }
              }}
              disabled={returnToBot.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {returnToBot.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Reativando...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
