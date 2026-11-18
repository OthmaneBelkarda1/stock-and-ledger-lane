import { useMemo } from "react";
import { useErp } from "./store";
import { useSession } from "./session";
import type { User } from "./types";

export const useData = () => useErp((s) => s.data);

export function useCurrentUser(): User {
  const id = useSession((s) => s.userId);
  const users = useErp((s) => s.data.users);
  return useMemo(() => users.find((u) => u.id === id) ?? users[0], [users, id]);
}

/** Données visibles par l'utilisateur connecté (cloisonnement par commercial). */
export function useScoped() {
  const data = useData();
  const user = useCurrentUser();
  return useMemo(() => {
    const isAdmin = user.role === "admin";
    if (isAdmin)
      return {
        data,
        user,
        isAdmin,
        clients: data.clients,
        devis: data.devis,
        commandes: data.commandes,
        factures: data.factures,
        paiements: data.paiements,
      };
    const clients = data.clients.filter((c) => c.commercialId === user.id);
    const clientIds = new Set(clients.map((c) => c.id));
    const factures = data.factures.filter(
      (f) => f.commercialId === user.id || clientIds.has(f.clientId),
    );
    const fIds = new Set(factures.map((f) => f.id));
    return {
      data,
      user,
      isAdmin,
      clients,
      devis: data.devis.filter((d) => d.commercialId === user.id),
      commandes: data.commandes.filter((c) => c.commercialId === user.id),
      factures,
      paiements: data.paiements.filter((p) => fIds.has(p.factureId)),
    };
  }, [data, user]);
}

export function useNotifications() {
  const notifications = useErp((s) => s.data.notifications);
  const user = useCurrentUser();
  return useMemo(() => {
    const list = notifications.filter(
      (n) =>
        n.cible === "tous" || n.cible === user.id || (n.cible === "admin" && user.role === "admin"),
    );
    return { list, unread: list.filter((n) => !n.lu).length };
  }, [notifications, user]);
}
