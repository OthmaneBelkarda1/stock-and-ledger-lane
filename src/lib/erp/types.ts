export type Role = "admin" | "commercial";

export interface User {
  id: string;
  nom: string;
  email: string;
  /** Démonstration uniquement : à remplacer par une authentification backend. */
  motDePasse: string;
  role: Role;
  telephone: string;
  avatar?: string;
  dateRecrutement: string;
  actif: boolean;
  objectifMensuel: number;
}

export type Categorie =
  | "Carrelage intérieur"
  | "Carrelage extérieur"
  | "Grès cérame"
  | "Faïence"
  | "Marbre"
  | "Mosaïque"
  | "Accessoires";

export type Finition = "Mat" | "Brillant" | "Poli" | "Antidérapant" | "Structuré";

export interface Product {
  id: string;
  image: string; // clé d'image de la bibliothèque ou data URL
  nom: string;
  sku: string;
  marque: string;
  collection: string;
  categorie: Categorie;
  dimension: string;
  couleur: string;
  finition: Finition;
  matiere: string;
  prixM2: number;
  prixCarton: number;
  m2ParCarton: number;
  piecesParCarton: number;
  seuilMin: number; // en cartons
  fournisseurId: string;
  description: string;
  dateCreation: string;
}

export interface Depot {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
}

export interface Lot {
  id: string;
  productId: string;
  depotId: string;
  numero: string;
  calibre: string;
  tonalite: string;
  refFabrication: string;
  cartons: number;
  dateEntree: string;
}

export type MovementType = "entree" | "sortie" | "reservation" | "liberation" | "transfert" | "inventaire";

export interface Movement {
  id: string;
  date: string;
  productId: string;
  type: MovementType;
  quantite: number; // cartons (signé pour l'inventaire)
  unite: "carton";
  depotId: string;
  depotDestId?: string;
  userId: string;
  motif: string;
  commandeId?: string;
  fournisseurId?: string;
  lot?: string;
}

export type ClientType =
  | "Particulier"
  | "Entreprise"
  | "Promoteur immobilier"
  | "Entrepreneur"
  | "Architecte"
  | "Revendeur";

export interface Client {
  id: string;
  nom: string;
  type: ClientType;
  telephone: string;
  email: string;
  adresse: string;
  ville: string;
  commercialId: string;
  dateCreation: string;
  ice?: string;
}

export interface Supplier {
  id: string;
  nom: string;
  contact: string;
  telephone: string;
  email: string;
  adresse: string;
  ville: string;
  pays: string;
}

export type Unite = "carton" | "m2" | "piece";

export interface LigneDoc {
  id: string;
  productId: string;
  designation: string;
  unite: Unite;
  quantite: number;
  prixUnitaire: number;
  remise: number; // %
}

export type DevisStatut = "brouillon" | "envoye" | "accepte" | "refuse" | "expire";

export interface Devis {
  id: string;
  numero: string;
  clientId: string;
  commercialId: string;
  date: string;
  validite: string;
  statut: DevisStatut;
  lignes: LigneDoc[];
  tauxTVA: number;
  remiseGlobale: number; // %
  notes: string;
  commandeId?: string;
}

export type CommandeStatut =
  | "en_attente"
  | "confirmee"
  | "en_preparation"
  | "prete"
  | "livree"
  | "annulee";

export interface Commande {
  id: string;
  numero: string;
  clientId: string;
  commercialId: string;
  date: string;
  dateLivraison: string;
  statut: CommandeStatut;
  lignes: LigneDoc[];
  tauxTVA: number;
  remiseGlobale: number;
  notes: string;
  depotId: string;
  devisId?: string;
  factureId?: string;
  stockDeduit: boolean;
  dateConfirmation?: string;
}

export interface Facture {
  id: string;
  numero: string;
  commandeId: string;
  clientId: string;
  commercialId: string;
  date: string;
  echeance: string;
  lignes: LigneDoc[];
  tauxTVA: number;
  remiseGlobale: number;
  notes: string;
}

export type ModePaiement = "especes" | "virement" | "cheque" | "carte";

export interface Paiement {
  id: string;
  numero: string;
  factureId: string;
  clientId: string;
  date: string;
  montant: number;
  mode: ModePaiement;
  reference: string;
  note: string;
  userId: string;
}

export type NiveauNotif = "info" | "succes" | "alerte" | "critique";

export interface Notification {
  id: string;
  date: string;
  titre: string;
  message: string;
  niveau: NiveauNotif;
  lu: boolean;
  /** "admin" = administrateurs, sinon id utilisateur, "tous" = tout le monde */
  cible: string;
  lien?: string;
}

export interface Activite {
  id: string;
  date: string;
  userId: string;
  action: string;
  description: string;
}

export interface Settings {
  societe: {
    nom: string;
    logo?: string;
    slogan: string;
    adresse: string;
    ville: string;
    telephone: string;
    email: string;
    siteWeb: string;
    ice: string;
    rc: string;
    if: string;
    patente: string;
    banque: string;
    rib: string;
  };
  devise: string;
  tauxTVA: number;
  remiseMax: number;
  conditionsPaiement: string;
  validiteDevisJours: number;
  prefixes: { devis: string; commande: string; facture: string; paiement: string };
  compteurs: { devis: number; commande: number; facture: number; paiement: number };
}

export interface ErpData {
  version: number;
  users: User[];
  products: Product[];
  depots: Depot[];
  lots: Lot[];
  movements: Movement[];
  clients: Client[];
  suppliers: Supplier[];
  devis: Devis[];
  commandes: Commande[];
  factures: Facture[];
  paiements: Paiement[];
  notifications: Notification[];
  activites: Activite[];
  settings: Settings;
  dimensions: string[];
}
