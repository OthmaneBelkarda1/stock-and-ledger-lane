import {
  cartonsCommande,
  dansPlage,
  estVente,
  ligneNet,
  round2,
  stockDisponible,
  stockPhysique,
  stockReserve,
  totaux,
  etatStock,
  type Plage,
} from "./calc";
import { CATEGORIES } from "./constants";
import { fmtMonthShort } from "./format";
import type { Commande, ErpData } from "./types";

export const ventesDans = (cmds: Commande[], p: Plage) =>
  cmds.filter((c) => estVente(c) && dansPlage(c.date, p));
export const ca = (cmds: Commande[]) =>
  round2(cmds.filter(estVente).reduce((s, c) => s + totaux(c).ttc, 0));

export function caParMois(cmds: Commande[], now = new Date(), mois = 12) {
  const res: { mois: string; ca: number; commandes: number; key: string }[] = [];
  for (let i = mois - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const list = ventesDans(cmds, { start: d, end });
    const label = fmtMonthShort(d);
    res.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      mois: label.charAt(0).toUpperCase() + label.slice(1),
      ca: ca(list),
      commandes: list.length,
    });
  }
  return res;
}

export function caParCommercial(data: ErpData, cmds: Commande[]) {
  return data.users
    .filter((u) => u.role === "commercial")
    .map((u) => {
      const list = cmds.filter((c) => c.commercialId === u.id && estVente(c));
      return {
        id: u.id,
        nom: u.nom,
        prenom: u.nom.split(" ")[0],
        ca: ca(list),
        commandes: list.length,
        objectif: u.objectifMensuel,
        actif: u.actif,
      };
    })
    .sort((a, b) => b.ca - a.ca);
}

export function topProduits(data: ErpData, cmds: Commande[], n = 10) {
  const map = new Map<string, { quantite: number; ca: number }>();
  for (const c of cmds.filter(estVente)) {
    const ct = cartonsCommande(data, c);
    const facteur = 1 - (c.remiseGlobale || 0) / 100;
    for (const l of c.lignes) {
      const cur = map.get(l.productId) ?? { quantite: 0, ca: 0 };
      cur.ca += ligneNet(l) * facteur * (1 + c.tauxTVA / 100);
      map.set(l.productId, cur);
    }
    for (const [pid, q] of Object.entries(ct)) {
      const cur = map.get(pid)!;
      cur.quantite += q;
    }
  }
  return [...map.entries()]
    .map(([pid, v]) => {
      const p = data.products.find((x) => x.id === pid);
      return {
        id: pid,
        nom: p?.nom ?? "Produit supprimé",
        court: (p?.nom ?? "—").split(" ").slice(0, 2).join(" "),
        quantite: v.quantite,
        ca: round2(v.ca),
        image: p?.image ?? "",
      };
    })
    .sort((a, b) => b.ca - a.ca)
    .slice(0, n);
}

export function caParCategorie(data: ErpData, cmds: Commande[]) {
  const map = new Map<string, number>(CATEGORIES.map((c) => [c, 0]));
  for (const c of cmds.filter(estVente)) {
    const facteur = (1 - (c.remiseGlobale || 0) / 100) * (1 + c.tauxTVA / 100);
    for (const l of c.lignes) {
      const p = data.products.find((x) => x.id === l.productId);
      if (p) map.set(p.categorie, (map.get(p.categorie) ?? 0) + ligneNet(l) * facteur);
    }
  }
  return [...map.entries()]
    .map(([categorie, v]) => ({ categorie, ca: round2(v) }))
    .filter((x) => x.ca > 0)
    .sort((a, b) => b.ca - a.ca);
}

export function syntheseStock(data: ErpData) {
  let valeur = 0;
  let disponible = 0;
  let reserve = 0;
  let faible = 0;
  let rupture = 0;
  let m2 = 0;
  const lignes = data.products.map((p) => {
    const phys = stockPhysique(data, p.id);
    const res = stockReserve(data, p.id);
    const dispo = stockDisponible(data, p.id);
    const etat = etatStock(dispo, p.seuilMin);
    valeur += phys * p.prixCarton;
    disponible += Math.max(0, dispo);
    reserve += res;
    m2 += phys * p.m2ParCarton;
    if (etat === "faible") faible++;
    if (etat === "rupture") rupture++;
    return { product: p, physique: phys, reserve: res, disponible: dispo, etat };
  });
  return {
    valeur: round2(valeur),
    disponible,
    reserve,
    faible,
    rupture,
    m2: round2(m2),
    lignes,
    references: data.products.length,
  };
}
