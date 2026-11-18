import type {
  Categorie,
  ClientType,
  CommandeStatut,
  DevisStatut,
  Finition,
  ModePaiement,
  MovementType,
  NiveauNotif,
  Unite,
} from "./types";

export const CATEGORIES: Categorie[] = [
  "Carrelage intérieur",
  "Carrelage extérieur",
  "Grès cérame",
  "Faïence",
  "Marbre",
  "Mosaïque",
  "Accessoires",
];
export const FINITIONS: Finition[] = ["Mat", "Brillant", "Poli", "Antidérapant", "Structuré"];
export const DIMENSIONS_DEFAUT = [
  "30 × 30 cm",
  "30 × 60 cm",
  "45 × 45 cm",
  "60 × 60 cm",
  "60 × 120 cm",
  "80 × 80 cm",
  "120 × 120 cm",
];
export const CLIENT_TYPES: ClientType[] = [
  "Particulier",
  "Entreprise",
  "Promoteur immobilier",
  "Entrepreneur",
  "Architecte",
  "Revendeur",
];
export const VILLES = [
  "Casablanca",
  "Rabat",
  "Témara",
  "Salé",
  "Marrakech",
  "Tanger",
  "Agadir",
  "Fès",
];

export const UNITE_LABELS: Record<Unite, string> = { carton: "Carton", m2: "m²", piece: "Pièce" };

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary" | "sand";

export const DEVIS_STATUTS: Record<DevisStatut, { label: string; tone: Tone }> = {
  brouillon: { label: "Brouillon", tone: "neutral" },
  envoye: { label: "Envoyé", tone: "info" },
  accepte: { label: "Accepté", tone: "success" },
  refuse: { label: "Refusé", tone: "danger" },
  expire: { label: "Expiré", tone: "warning" },
};

export const COMMANDE_STATUTS: Record<CommandeStatut, { label: string; tone: Tone }> = {
  en_attente: { label: "En attente", tone: "neutral" },
  confirmee: { label: "Confirmée", tone: "info" },
  en_preparation: { label: "En préparation", tone: "sand" },
  prete: { label: "Prête à livrer", tone: "primary" },
  livree: { label: "Livrée", tone: "success" },
  annulee: { label: "Annulée", tone: "danger" },
};
export const COMMANDE_FLOW: CommandeStatut[] = [
  "en_attente",
  "confirmee",
  "en_preparation",
  "prete",
  "livree",
];

export type FactureStatut = "payee" | "partielle" | "impayee";
export const FACTURE_STATUTS: Record<FactureStatut, { label: string; tone: Tone }> = {
  payee: { label: "Payée", tone: "success" },
  partielle: { label: "Partiellement payée", tone: "warning" },
  impayee: { label: "Impayée", tone: "danger" },
};

export const MODES_PAIEMENT: Record<ModePaiement, string> = {
  especes: "Espèces",
  virement: "Virement bancaire",
  cheque: "Chèque",
  carte: "Carte bancaire",
};

export const MOUVEMENT_TYPES: Record<MovementType, { label: string; tone: Tone }> = {
  entree: { label: "Entrée", tone: "success" },
  sortie: { label: "Sortie", tone: "danger" },
  reservation: { label: "Réservation", tone: "info" },
  liberation: { label: "Libération", tone: "neutral" },
  transfert: { label: "Transfert", tone: "sand" },
  inventaire: { label: "Inventaire", tone: "primary" },
};

export const NIVEAUX_NOTIF: Record<NiveauNotif, { label: string; tone: Tone }> = {
  info: { label: "Information", tone: "info" },
  succes: { label: "Succès", tone: "success" },
  alerte: { label: "Alerte", tone: "warning" },
  critique: { label: "Critique", tone: "danger" },
};
