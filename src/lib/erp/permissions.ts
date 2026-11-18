import type { Role, User } from "./types";

/**
 * Matrice des permissions — simulation côté interface pour la démonstration.
 * En production, ces règles doivent être appliquées par l'API (backend) et la base de données.
 */
export type Permission =
  | "voir_ca_global"
  | "voir_tous_clients"
  | "gerer_produits"
  | "gerer_stock"
  | "gerer_fournisseurs"
  | "gerer_factures"
  | "enregistrer_paiement"
  | "gerer_commerciaux"
  | "voir_rapports"
  | "voir_activites"
  | "gerer_parametres"
  | "gerer_utilisateurs"
  | "changer_statut_commande";

export const PERMISSION_LABELS: Record<Permission, string> = {
  voir_ca_global: "Consulter le chiffre d'affaires global",
  voir_tous_clients: "Consulter tous les clients",
  gerer_produits: "Créer et modifier les produits",
  gerer_stock: "Gérer les mouvements de stock",
  gerer_fournisseurs: "Gérer les fournisseurs",
  gerer_factures: "Générer les factures",
  enregistrer_paiement: "Enregistrer les paiements",
  gerer_commerciaux: "Gérer l'équipe commerciale",
  voir_rapports: "Accéder aux rapports",
  voir_activites: "Consulter le journal d'activité",
  gerer_parametres: "Configurer l'entreprise",
  gerer_utilisateurs: "Gérer les utilisateurs",
  changer_statut_commande: "Faire avancer les commandes (préparation, livraison)",
};

export const ROLE_LABELS: Record<Role, string> = { admin: "Administrateur", commercial: "Commercial" };

const ALL = Object.keys(PERMISSION_LABELS) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  commercial: [],
};

export const can = (user: Pick<User, "role"> | null | undefined, perm: Permission) =>
  !!user && ROLE_PERMISSIONS[user.role].includes(perm);
