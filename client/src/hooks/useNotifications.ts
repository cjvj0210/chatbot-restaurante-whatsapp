import { useEffect, useRef, useCallback, useState } from "react";

type NotificationPermission = "default" | "granted" | "denied";

interface UseNotificationsOptions {
  /** Título da notificação */
  title: string;
  /** Corpo da notificação */
  body: string;
  /** Ícone da notificação */
  icon?: string;
  /** Tag para agrupar notificações (evita duplicatas) */
  tag?: string;
  /** Se deve enviar notificação */
  enabled: boolean;
  /** Callback ao clicar na notificação */
  onClick?: () => void;
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.warn("Navegador não suporta notificações");
      return "denied" as NotificationPermission;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}

export function usePushNotification({
  title,
  body,
  icon,
  tag,
  enabled,
  onClick,
}: UseNotificationsOptions) {
  const notificationRef = useRef<Notification | null>(null);
  const prevEnabledRef = useRef(false);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // Só envia quando transiciona de false para true (novo evento)
    if (enabled && !prevEnabledRef.current) {
      // Fecha notificação anterior se existir
      if (notificationRef.current) {
        notificationRef.current.close();
      }

      try {
        const notification = new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
          tag: tag || "default",
          requireInteraction: true, // Mantém visível até o usuário interagir
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          onClickRef.current?.();
        };

        notificationRef.current = notification;
      } catch (e) {
        console.warn("Erro ao criar notificação:", e);
      }
    }

    // Se não está mais habilitado, fecha a notificação
    if (!enabled && notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }

    prevEnabledRef.current = enabled;
  }, [enabled, title, body, icon, tag]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (notificationRef.current) {
        notificationRef.current.close();
      }
    };
  }, []);
}

/**
 * Hook que monitora pedidos e reservas pendentes e envia notificações push.
 * Deve ser usado no DashboardLayout para funcionar em todas as páginas.
 */
export function useAdminNotifications(
  pendingOrders: number,
  pendingReservations: number,
  humanModeActive: number
) {
  const { permission, requestPermission } = useNotificationPermission();
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  
  // Track previous counts to detect new items
  const prevOrdersRef = useRef(pendingOrders);
  const prevReservationsRef = useRef(pendingReservations);
  const prevHumanModeRef = useRef(humanModeActive);
  
  const [newOrders, setNewOrders] = useState(false);
  const [newReservations, setNewReservations] = useState(false);
  const [newHumanMode, setNewHumanMode] = useState(false);

  // Solicitar permissão automaticamente na primeira vez que houver pendências
  useEffect(() => {
    if (
      !hasRequestedPermission &&
      permission === "default" &&
      (pendingOrders > 0 || pendingReservations > 0 || humanModeActive > 0)
    ) {
      requestPermission();
      setHasRequestedPermission(true);
    }
  }, [pendingOrders, pendingReservations, humanModeActive, permission, hasRequestedPermission, requestPermission]);

  // Detectar novos itens (contagem aumentou)
  useEffect(() => {
    if (pendingOrders > prevOrdersRef.current) {
      setNewOrders(true);
      // Auto-reset após 30s
      setTimeout(() => setNewOrders(false), 30000);
    }
    prevOrdersRef.current = pendingOrders;
  }, [pendingOrders]);

  useEffect(() => {
    if (pendingReservations > prevReservationsRef.current) {
      setNewReservations(true);
      setTimeout(() => setNewReservations(false), 30000);
    }
    prevReservationsRef.current = pendingReservations;
  }, [pendingReservations]);

  useEffect(() => {
    if (humanModeActive > prevHumanModeRef.current) {
      setNewHumanMode(true);
      setTimeout(() => setNewHumanMode(false), 30000);
    }
    prevHumanModeRef.current = humanModeActive;
  }, [humanModeActive]);

  // Notificação de pedidos
  usePushNotification({
    title: `🍽️ ${pendingOrders} pedido${pendingOrders > 1 ? "s" : ""} pendente${pendingOrders > 1 ? "s" : ""}!`,
    body: "Novos pedidos aguardando aceitação no painel.",
    tag: "pending-orders",
    enabled: newOrders && permission === "granted",
    onClick: () => {
      window.location.hash = "";
      window.location.pathname = "/orders";
    },
  });

  // Notificação de reservas
  usePushNotification({
    title: `📅 ${pendingReservations} reserva${pendingReservations > 1 ? "s" : ""} pendente${pendingReservations > 1 ? "s" : ""}!`,
    body: "Novas reservas aguardando confirmação no painel.",
    tag: "pending-reservations",
    enabled: newReservations && permission === "granted",
    onClick: () => {
      window.location.hash = "";
      window.location.pathname = "/reservations";
    },
  });

  // Notificação de modo humano
  usePushNotification({
    title: `🎧 ${humanModeActive} conversa${humanModeActive > 1 ? "s" : ""} em modo humano!`,
    body: "Clientes aguardando atendimento humano.",
    tag: "human-mode",
    enabled: newHumanMode && permission === "granted",
    onClick: () => {
      window.location.hash = "";
      window.location.pathname = "/modo-humano";
    },
  });

  return { permission, requestPermission };
}
