import type { Commande, CommandeStatut, ErpData, Facture, LigneDoc, Product, Unite } from "./types";
import type { FactureStatut } from "./constants";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------- Conversions céramique ---------- */

/** Équivalent en cartons d'une quantité exprimée dans l'unité donnée. */
export function toCartons(
  p: Pick<Product, "m2ParCarton" | "piecesParCarton">,
  unite: Unite,
  qte: number,
) {
  if (unite === "carton") return qte;
  if (unite === "m2") return p.m2ParCarton > 0 ? qte / p.m2ParCarton : 0;
  return p.piecesParCarton > 0 ? qte / p.piecesParCarton : 0;
}
/** Cartons entiers nécessaires pour servir la quantité (arrondi supérieur). */
export const cartonsNecessaires = (
  p: Pick<Product, "m2ParCarton" | "piecesParCarton">,
  unite: Unite,
  qte: number,
) => Math.ceil(round2(toCartons(p, unite, qte)) - 1e-9);
export const cartonsToM2 = (p: Pick<Product, "m2ParCarton">, cartons: number) =>
  round2(cartons * p.m2ParCarton);
export const cartonsToPieces = (p: Pick<Product, "piecesParCarton">, cartons: number) =>
  Math.round(cartons * p.piecesParCarton);

export function prixUnitaire(
  p: Pick<Product, "prixM2" | "prixCarton" | "piecesParCarton">,
  unite: Unite,
) {
  if (unite === "carton") return p.prixCarton;
  if (unite === "m2") return p.prixM2;
  return p.piecesParCarton > 0 ? round2(p.prixCarton / p.piecesParCarton) : 0;
}

/* ---------- Montants des documents ---------- */

export const ligneBrut = (l: Pick<LigneDoc, "quantite" | "prixUnitaire">) =>
  l.quantite * l.prixUnitaire;
export const ligneNet = (l: Pick<LigneDoc, "quantite" | "prixUnitaire" | "remise">) =>
  ligneBrut(l) * (1 - (l.remise || 0) / 100);

export interface Totaux {
  sousTotal: number;
  remise: number;
  ht: number;
  tva: number;
  ttc: number;
}

export function totaux(doc: {
  lignes: LigneDoc[];
  tauxTVA: number;
  remiseGlobale: number;
}): Totaux {
  const sousTotal = doc.lignes.reduce((s, l) => s + ligneBrut(l), 0);
  const apresLignes = doc.lignes.reduce((s, l) => s + ligneNet(l), 0);
  const remiseGlobale = apresLignes * ((doc.remiseGlobale || 0) / 100);
  const ht = apresLignes - remiseGlobale;
  const tva = ht * ((doc.tauxTVA || 0) / 100);
  return {
    sousTotal: round2(sousTotal),
    remise: round2(sousTotal - ht),
    ht: round2(ht),
    tva: round2(tva),
    ttc: round2(ht + tva),
  };
}

/* ---------- Stock ---------- */

export const STATUTS_RESERVANTS: CommandeStatut[] = ["confirmee", "en_preparation", "prete"];
export const STATUTS_VENTE: CommandeStatut[] = ["confirmee", "en_preparation", "prete", "livree"];

export function stockPhysique(data: Pick<ErpData, "lots">, productId: string, depotId?: string) {
  return data.lots
    .filter((l) => l.productId === productId && (!depotId || l.depotId === depotId))
    .reduce((s, l) => s + l.cartons, 0);
}

export function cartonsCommande(
  data: Pick<ErpData, "products">,
  c: Pick<Commande, "lignes">,
  productId?: string,
) {
  const res: Record<string, number> = {};
  for (const l of c.lignes) {
    if (productId && l.productId !== productId) continue;
    const p = data.products.find((x) => x.id === l.productId);
    if (!p) continue;
    res[l.productId] = (res[l.productId] || 0) + cartonsNecessaires(p, l.unite, l.quantite);
  }
  return res;
}

/** Réservé = commandes confirmées non encore livrées (pas de double déduction). */
export function stockReserve(data: Pick<ErpData, "commandes" | "products">, productId: string) {
  return data.commandes
    .filter((c) => STATUTS_RESERVANTS.includes(c.statut) && !c.stockDeduit)
    .reduce((s, c) => s + (cartonsCommande(data, c, productId)[productId] || 0), 0);
}

export function stockDisponible(
  data: Pick<ErpData, "lots" | "commandes" | "products">,
  productId: string,
) {
  return stockPhysique(data, productId) - stockReserve(data, productId);
}

export type EtatStock = "rupture" | "faible" | "ok";
export function etatStock(disponible: number, seuil: number): EtatStock {
  if (disponible <= 0) return "rupture";
  if (disponible <= seuil) return "faible";
  return "ok";
}

/* ---------- Factures & paiements ---------- */

export function montantPaye(data: Pick<ErpData, "paiements">, factureId: string) {
  return round2(
    data.paiements.filter((p) => p.factureId === factureId).reduce((s, p) => s + p.montant, 0),
  );
}

export function soldeFacture(data: Pick<ErpData, "paiements">, f: Facture) {
  const ttc = totaux(f).ttc;
  const paye = montantPaye(data, f.id);
  return { ttc, paye, reste: round2(Math.max(0, ttc - paye)) };
}

export function statutFacture(data: Pick<ErpData, "paiements">, f: Facture): FactureStatut {
  const { ttc, paye } = soldeFacture(data, f);
  if (paye <= 0.009) return "impayee";
  if (paye + 0.009 >= ttc) return "payee";
  return "partielle";
}

/* ---------- Périodes ---------- */

export type Periode = "jour" | "semaine" | "mois" | "annee" | "perso";
export interface Plage {
  start: Date;
  end: Date;
}

export function plagePeriode(
  periode: Periode,
  perso?: { from?: Date; to?: Date },
  now = new Date(),
): Plage {
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);
  if (periode === "semaine") {
    const day = (start.getDay() + 6) % 7; // lundi = 0
    start.setDate(start.getDate() - day);
  } else if (periode === "mois") {
    start.setDate(1);
  } else if (periode === "annee") {
    start.setMonth(0, 1);
  } else if (periode === "perso" && perso?.from) {
    const s = new Date(perso.from);
    s.setHours(0, 0, 0, 0);
    const e = new Date(perso.to ?? perso.from);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  return { start, end };
}

/** Période précédente de même durée (pour les comparaisons). */
export function plagePrecedente(p: Plage): Plage {
  const len = p.end.getTime() - p.start.getTime();
  return { start: new Date(p.start.getTime() - len - 1), end: new Date(p.start.getTime() - 1) };
}

export const dansPlage = (iso: string, p: Plage) => {
  const t = new Date(iso).getTime();
  return t >= p.start.getTime() && t <= p.end.getTime();
};

export const evolution = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

export const estVente = (c: Commande) => STATUTS_VENTE.includes(c.statut);
export const caCommandes = (cmds: Commande[]) =>
  round2(cmds.filter(estVente).reduce((s, c) => s + totaux(c).ttc, 0));
