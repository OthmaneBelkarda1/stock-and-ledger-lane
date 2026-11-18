import { create } from "zustand";
import { useErp } from "./store";

const KEY = "erp-ceramique-session";

interface SessionState {
  userId: string | null;
  ready: boolean;
  init: () => void;
  login: (
    email: string,
    password: string,
    remember: boolean,
  ) => { ok: true } | { ok: false; error: string };
  loginAs: (userId: string) => void;
  logout: () => void;
}

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/**
 * Authentification SIMULÉE pour la démonstration (aucune sécurité réelle).
 * À remplacer par un appel à l'API d'authentification (jeton JWT / session serveur).
 */
export const useSession = create<SessionState>()((set) => ({
  userId: null,
  ready: false,
  init: () => {
    const id = read();
    const user = useErp.getState().data.users.find((u) => u.id === id && u.actif);
    if (user) useErp.getState().setActor(user.id);
    set({ userId: user ? user.id : null, ready: true });
  },
  login: (email, password, remember) => {
    const e = email.trim().toLowerCase();
    if (!e || !password)
      return { ok: false, error: "Veuillez saisir votre adresse e-mail et votre mot de passe." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      return { ok: false, error: "L'adresse e-mail saisie n'est pas valide." };
    const user = useErp.getState().data.users.find((u) => u.email.toLowerCase() === e);
    if (!user || user.motDePasse !== password)
      return { ok: false, error: "Adresse e-mail ou mot de passe incorrect." };
    if (!user.actif)
      return { ok: false, error: "Ce compte est désactivé. Contactez votre administrateur." };
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      (remember ? localStorage : sessionStorage).setItem(KEY, user.id);
    } catch {
      /* stockage indisponible */
    }
    useErp.getState().setActor(user.id);
    set({ userId: user.id });
    return { ok: true };
  },
  loginAs: (userId) => {
    try {
      localStorage.setItem(KEY, userId);
    } catch {
      /* ignore */
    }
    useErp.getState().setActor(userId);
    set({ userId });
  },
  logout: () => {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ userId: null });
  },
}));
