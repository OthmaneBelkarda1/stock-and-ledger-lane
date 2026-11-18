import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  cartonsCommande,
  etatStock,
  round2,
  soldeFacture,
  stockDisponible,
  stockPhysique,
  STATUTS_RESERVANTS,
  totaux,
} from "./calc";
import { COMMANDE_STATUTS } from "./constants";
import { fmtMAD, uid } from "./format";
import { createSeed, DATA_VERSION } from "./seed";
import type {
  Client,
  Commande,
  CommandeStatut,
  Depot,
  Devis,
  DevisStatut,
  ErpData,
  Facture,
  ModePaiement,
  NiveauNotif,
  Paiement,
  Product,
  Settings,
  Supplier,
  User,
} from "./types";

export class ErpError extends Error {}

interface ErpState {
  data: ErpData;
  hydrated: boolean;
  /** Identifiant de l'utilisateur à l'origine des actions (journal d'activité). */
  actorId: string;
  setActor: (id: string) => void;
  resetDemo: () => void;
  // Paramètres
  updateSettings: (s: Partial<Settings>) => void;
  updateSociete: (s: Partial<Settings["societe"]>) => void;
  setDimensions: (d: string[]) => void;
  // Produits
  saveProduct: (p: Omit<Product, "id" | "dateCreation"> & { id?: string }) => string;
  deleteProduct: (id: string) => void;
  // Stocks
  entreeStock: (i: {
    productId: string;
    depotId: string;
    cartons: number;
    lot: string;
    calibre: string;
    tonalite: string;
    refFabrication: string;
    fournisseurId?: string;
    motif: string;
  }) => void;
  sortieStock: (i: {
    productId: string;
    depotId: string;
    cartons: number;
    motif: string;
    commandeId?: string;
  }) => void;
  transfertStock: (i: {
    productId: string;
    from: string;
    to: string;
    cartons: number;
    motif: string;
  }) => void;
  inventaire: (i: { productId: string; depotId: string; compte: number; motif: string }) => void;
  // Dépôts
  saveDepot: (d: Omit<Depot, "id"> & { id?: string }) => void;
  deleteDepot: (id: string) => void;
  // Clients
  saveClient: (c: Omit<Client, "id" | "dateCreation"> & { id?: string }) => string;
  deleteClient: (id: string) => void;
  // Fournisseurs
  saveSupplier: (s: Omit<Supplier, "id"> & { id?: string }) => string;
  deleteSupplier: (id: string) => void;
  // Utilisateurs
  saveUser: (u: Omit<User, "id"> & { id?: string }) => string;
  toggleUser: (id: string) => void;
  assignClients: (userId: string, clientIds: string[]) => void;
  // Devis
  saveDevis: (d: Omit<Devis, "id" | "numero"> & { id?: string }) => string;
  deleteDevis: (id: string) => void;
  duplicateDevis: (id: string) => string;
  setDevisStatut: (id: string, s: DevisStatut) => void;
  convertirDevis: (id: string) => string;
  // Commandes
  saveCommande: (c: Omit<Commande, "id" | "numero" | "stockDeduit"> & { id?: string }) => string;
  setCommandeStatut: (id: string, s: CommandeStatut) => void;
  genererFacture: (commandeId: string) => string;
  // Paiements
  addPaiement: (p: {
    factureId: string;
    montant: number;
    mode: ModePaiement;
    date: string;
    reference: string;
    note: string;
  }) => string;
  deletePaiement: (id: string) => void;
  // Notifications
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  deleteNotification: (id: string) => void;
}

const nextNumero = (d: ErpData, kind: keyof Settings["compteurs"]) => {
  d.settings.compteurs[kind] += 1;
  const prefix = d.settings.prefixes[kind];
  return `${prefix}-${new Date().getFullYear()}-${String(d.settings.compteurs[kind]).padStart(4, "0")}`;
};

const log = (d: ErpData, userId: string, action: string, description: string) => {
  d.activites.unshift({
    id: uid("a-"),
    date: new Date().toISOString(),
    userId,
    action,
    description,
  });
  if (d.activites.length > 400) d.activites.length = 400;
};

const notify = (
  d: ErpData,
  titre: string,
  message: string,
  niveau: NiveauNotif,
  cible: string,
  lien?: string,
) => {
  d.notifications.unshift({
    id: uid("n-"),
    date: new Date().toISOString(),
    titre,
    message,
    niveau,
    lu: false,
    cible,
    lien,
  });
};

/** Compare l'état du stock avant/après une opération et crée les alertes nécessaires. */
const checkAlerts = (before: ErpData, after: ErpData) => {
  for (const p of after.products) {
    const avant = etatStock(stockDisponible(before, p.id), p.seuilMin);
    const apres = etatStock(stockDisponible(after, p.id), p.seuilMin);
    if (avant === apres || apres === "ok") continue;
    if (apres === "rupture")
      notify(
        after,
        "Produit en rupture",
        `${p.nom} ${p.dimension} n'est plus disponible.`,
        "critique",
        "tous",
        "/stocks",
      );
    else if (avant === "ok")
      notify(
        after,
        "Stock faible",
        `${p.nom} ${p.dimension} est passé sous le seuil minimal (${p.seuilMin} cartons).`,
        "alerte",
        "tous",
        "/stocks",
      );
  }
};

/** Retire des cartons des lots d'un dépôt (FIFO). */
const consumeLots = (d: ErpData, productId: string, depotId: string, cartons: number) => {
  const dispo = stockPhysique(d, productId, depotId);
  if (cartons > dispo) {
    // on complète avec les autres dépôts si besoin
    const total = stockPhysique(d, productId);
    if (cartons > total) throw new ErpError("Stock physique insuffisant pour cette opération.");
  }
  let reste = cartons;
  const ordered = [...d.lots]
    .filter((l) => l.productId === productId)
    .sort(
      (a, b) =>
        (a.depotId === depotId ? -1 : 0) - (b.depotId === depotId ? -1 : 0) ||
        a.dateEntree.localeCompare(b.dateEntree),
    );
  for (const lot of ordered) {
    if (reste <= 0) break;
    const take = Math.min(lot.cartons, reste);
    lot.cartons -= take;
    reste -= take;
  }
  d.lots = d.lots.filter((l) => l.cartons > 0);
};

export const useErp = create<ErpState>()(
  persist(
    (set, get) => {
      const mutate = <R>(fn: (d: ErpData, actor: string) => R, alerts = false): R => {
        const before = get().data;
        const d = structuredClone(before);
        const r = fn(d, get().actorId);
        if (alerts) checkAlerts(before, d);
        set({ data: d });
        return r;
      };
      const actorName = (d: ErpData, id: string) =>
        d.users.find((u) => u.id === id)?.nom ?? "Utilisateur";

      return {
        data: createSeed(),
        hydrated: false,
        actorId: "u-admin",
        setActor: (id) => set({ actorId: id }),
        resetDemo: () => set({ data: createSeed() }),

        updateSettings: (s) =>
          mutate((d, a) => {
            Object.assign(d.settings, s);
            log(d, a, "Paramètres", "Mise à jour des paramètres commerciaux");
          }),
        updateSociete: (s) =>
          mutate((d, a) => {
            Object.assign(d.settings.societe, s);
            log(d, a, "Paramètres", "Mise à jour des informations de l'entreprise");
          }),
        setDimensions: (dims) => mutate((d) => void (d.dimensions = dims)),

        saveProduct: (p) =>
          mutate((d, a) => {
            if (p.id) {
              const i = d.products.findIndex((x) => x.id === p.id);
              d.products[i] = { ...d.products[i], ...p, id: p.id };
              log(d, a, "Produit", `Modification du produit ${p.nom}`);
              return p.id;
            }
            if (d.products.some((x) => x.sku.toLowerCase() === p.sku.toLowerCase()))
              throw new ErpError("Cette référence SKU existe déjà.");
            const id = uid("p-");
            d.products.push({ ...p, id, dateCreation: new Date().toISOString() });
            log(d, a, "Produit", `Création du produit ${p.nom}`);
            return id;
          }),
        deleteProduct: (id) =>
          mutate((d, a) => {
            const used = d.commandes.some(
              (c) =>
                c.lignes.some((l) => l.productId === id) &&
                c.statut !== "annulee" &&
                c.statut !== "livree",
            );
            if (used)
              throw new ErpError(
                "Ce produit figure dans des commandes en cours : suppression impossible.",
              );
            const p = d.products.find((x) => x.id === id);
            d.products = d.products.filter((x) => x.id !== id);
            d.lots = d.lots.filter((l) => l.productId !== id);
            log(d, a, "Produit", `Suppression du produit ${p?.nom}`);
          }),

        entreeStock: (i) =>
          mutate((d, a) => {
            if (i.cartons <= 0) throw new ErpError("La quantité doit être supérieure à zéro.");
            const existing = d.lots.find(
              (l) => l.productId === i.productId && l.depotId === i.depotId && l.numero === i.lot,
            );
            if (existing) existing.cartons += i.cartons;
            else
              d.lots.push({
                id: uid("lot-"),
                productId: i.productId,
                depotId: i.depotId,
                numero: i.lot,
                calibre: i.calibre,
                tonalite: i.tonalite,
                refFabrication: i.refFabrication,
                cartons: i.cartons,
                dateEntree: new Date().toISOString(),
              });
            d.movements.unshift({
              id: uid("mv-"),
              date: new Date().toISOString(),
              productId: i.productId,
              type: "entree",
              quantite: i.cartons,
              unite: "carton",
              depotId: i.depotId,
              userId: a,
              motif: i.motif,
              fournisseurId: i.fournisseurId,
              lot: i.lot,
            });
            const p = d.products.find((x) => x.id === i.productId);
            log(d, a, "Stock", `Entrée de ${i.cartons} cartons — ${p?.nom}`);
          }, true),
        sortieStock: (i) =>
          mutate((d, a) => {
            if (i.cartons <= 0) throw new ErpError("La quantité doit être supérieure à zéro.");
            if (stockPhysique(d, i.productId, i.depotId) < i.cartons)
              throw new ErpError("Stock insuffisant dans ce dépôt.");
            consumeLots(d, i.productId, i.depotId, i.cartons);
            d.movements.unshift({
              id: uid("mv-"),
              date: new Date().toISOString(),
              productId: i.productId,
              type: "sortie",
              quantite: i.cartons,
              unite: "carton",
              depotId: i.depotId,
              userId: a,
              motif: i.motif,
              commandeId: i.commandeId,
            });
            const p = d.products.find((x) => x.id === i.productId);
            log(d, a, "Stock", `Sortie de ${i.cartons} cartons — ${p?.nom}`);
          }, true),
        transfertStock: (i) =>
          mutate((d, a) => {
            if (i.from === i.to)
              throw new ErpError("Les dépôts de départ et d'arrivée doivent être différents.");
            if (stockPhysique(d, i.productId, i.from) < i.cartons)
              throw new ErpError("Stock insuffisant dans le dépôt de départ.");
            let reste = i.cartons;
            for (const lot of d.lots
              .filter((l) => l.productId === i.productId && l.depotId === i.from)
              .sort((x, y) => x.dateEntree.localeCompare(y.dateEntree))) {
              if (reste <= 0) break;
              const take = Math.min(lot.cartons, reste);
              lot.cartons -= take;
              reste -= take;
              const dest = d.lots.find(
                (l) => l.productId === i.productId && l.depotId === i.to && l.numero === lot.numero,
              );
              if (dest) dest.cartons += take;
              else
                d.lots.push({
                  ...lot,
                  id: uid("lot-"),
                  depotId: i.to,
                  cartons: take,
                  dateEntree: new Date().toISOString(),
                });
            }
            d.lots = d.lots.filter((l) => l.cartons > 0);
            d.movements.unshift({
              id: uid("mv-"),
              date: new Date().toISOString(),
              productId: i.productId,
              type: "transfert",
              quantite: i.cartons,
              unite: "carton",
              depotId: i.from,
              depotDestId: i.to,
              userId: a,
              motif: i.motif,
            });
            log(d, a, "Stock", `Transfert de ${i.cartons} cartons entre dépôts`);
          }),
        inventaire: (i) =>
          mutate((d, a) => {
            const actuel = stockPhysique(d, i.productId, i.depotId);
            const ecart = i.compte - actuel;
            if (ecart === 0) return;
            if (ecart > 0) {
              const lot = d.lots.find(
                (l) => l.productId === i.productId && l.depotId === i.depotId,
              );
              if (lot) lot.cartons += ecart;
              else
                d.lots.push({
                  id: uid("lot-"),
                  productId: i.productId,
                  depotId: i.depotId,
                  numero: "INV-" + new Date().getFullYear(),
                  calibre: "—",
                  tonalite: "—",
                  refFabrication: "—",
                  cartons: ecart,
                  dateEntree: new Date().toISOString(),
                });
            } else {
              let reste = -ecart;
              for (const lot of d.lots.filter(
                (l) => l.productId === i.productId && l.depotId === i.depotId,
              )) {
                const take = Math.min(lot.cartons, reste);
                lot.cartons -= take;
                reste -= take;
              }
              d.lots = d.lots.filter((l) => l.cartons > 0);
            }
            d.movements.unshift({
              id: uid("mv-"),
              date: new Date().toISOString(),
              productId: i.productId,
              type: "inventaire",
              quantite: ecart,
              unite: "carton",
              depotId: i.depotId,
              userId: a,
              motif: i.motif || "Ajustement d'inventaire",
            });
            log(d, a, "Stock", `Inventaire : écart de ${ecart > 0 ? "+" : ""}${ecart} cartons`);
          }, true),

        saveDepot: (dep) =>
          mutate((d, a) => {
            if (dep.id) {
              const i = d.depots.findIndex((x) => x.id === dep.id);
              d.depots[i] = { ...dep, id: dep.id };
            } else d.depots.push({ ...dep, id: uid("d-") });
            log(d, a, "Dépôt", `${dep.id ? "Modification" : "Création"} du dépôt ${dep.nom}`);
          }),
        deleteDepot: (id) =>
          mutate((d, a) => {
            if (d.lots.some((l) => l.depotId === id))
              throw new ErpError("Ce dépôt contient encore du stock.");
            d.depots = d.depots.filter((x) => x.id !== id);
            log(d, a, "Dépôt", "Suppression d'un dépôt");
          }),

        saveClient: (c) =>
          mutate((d, a) => {
            if (c.id) {
              const i = d.clients.findIndex((x) => x.id === c.id);
              d.clients[i] = { ...d.clients[i], ...c, id: c.id };
              log(d, a, "Client", `Modification du client ${c.nom}`);
              return c.id;
            }
            const id = uid("c-");
            d.clients.push({ ...c, id, dateCreation: new Date().toISOString() });
            log(d, a, "Client", `Ajout du client ${c.nom}`);
            notify(
              d,
              "Nouveau client ajouté",
              `${c.nom} (${c.ville}) a été ajouté par ${actorName(d, a)}.`,
              "info",
              "admin",
              `/clients/${id}`,
            );
            if (c.commercialId !== a)
              notify(
                d,
                "Nouveau client affecté",
                `${c.nom} vous a été affecté.`,
                "info",
                c.commercialId,
                `/clients/${id}`,
              );
            return id;
          }),
        deleteClient: (id) =>
          mutate((d, a) => {
            if (
              d.commandes.some((c) => c.clientId === id) ||
              d.factures.some((f) => f.clientId === id)
            )
              throw new ErpError(
                "Ce client possède des commandes ou des factures : suppression impossible.",
              );
            const c = d.clients.find((x) => x.id === id);
            d.clients = d.clients.filter((x) => x.id !== id);
            d.devis = d.devis.filter((x) => x.clientId !== id);
            log(d, a, "Client", `Suppression du client ${c?.nom}`);
          }),

        saveSupplier: (s) =>
          mutate((d, a) => {
            if (s.id) {
              const i = d.suppliers.findIndex((x) => x.id === s.id);
              d.suppliers[i] = { ...s, id: s.id };
              log(d, a, "Fournisseur", `Modification du fournisseur ${s.nom}`);
              return s.id;
            }
            const id = uid("f-");
            d.suppliers.push({ ...s, id });
            log(d, a, "Fournisseur", `Ajout du fournisseur ${s.nom}`);
            return id;
          }),
        deleteSupplier: (id) =>
          mutate((d, a) => {
            if (d.products.some((p) => p.fournisseurId === id))
              throw new ErpError("Des produits sont rattachés à ce fournisseur.");
            d.suppliers = d.suppliers.filter((x) => x.id !== id);
            log(d, a, "Fournisseur", "Suppression d'un fournisseur");
          }),

        saveUser: (u) =>
          mutate((d, a) => {
            const dup = d.users.find(
              (x) => x.email.toLowerCase() === u.email.toLowerCase() && x.id !== u.id,
            );
            if (dup) throw new ErpError("Cette adresse e-mail est déjà utilisée.");
            if (u.id) {
              const i = d.users.findIndex((x) => x.id === u.id);
              d.users[i] = { ...d.users[i], ...u, id: u.id };
              log(d, a, "Utilisateur", `Modification du compte ${u.nom}`);
              return u.id;
            }
            const id = uid("u-");
            d.users.push({ ...u, id });
            log(d, a, "Utilisateur", `Création du compte ${u.nom}`);
            return id;
          }),
        toggleUser: (id) =>
          mutate((d, a) => {
            const u = d.users.find((x) => x.id === id)!;
            if (
              u.role === "admin" &&
              u.actif &&
              d.users.filter((x) => x.role === "admin" && x.actif).length <= 1
            )
              throw new ErpError("Impossible de désactiver le dernier administrateur.");
            u.actif = !u.actif;
            log(
              d,
              a,
              "Utilisateur",
              `${u.actif ? "Activation" : "Désactivation"} du compte ${u.nom}`,
            );
          }),
        assignClients: (userId, ids) =>
          mutate((d, a) => {
            for (const c of d.clients) if (ids.includes(c.id)) c.commercialId = userId;
            log(d, a, "Client", `Affectation de ${ids.length} client(s) à ${actorName(d, userId)}`);
            notify(
              d,
              "Clients affectés",
              `${ids.length} client(s) vous ont été affectés.`,
              "info",
              userId,
              "/clients",
            );
          }),

        saveDevis: (dv) =>
          mutate((d, a) => {
            if (!dv.lignes.length) throw new ErpError("Ajoutez au moins un produit au devis.");
            if (dv.id) {
              const i = d.devis.findIndex((x) => x.id === dv.id);
              d.devis[i] = { ...d.devis[i], ...dv, id: dv.id };
              log(d, a, "Devis", `Modification du devis ${d.devis[i].numero}`);
              return dv.id;
            }
            const id = uid("dev-");
            const numero = nextNumero(d, "devis");
            d.devis.push({ ...dv, id, numero });
            log(d, a, "Devis", `Création du devis ${numero} (${fmtMAD(totaux(dv).ttc)})`);
            return id;
          }),
        deleteDevis: (id) =>
          mutate((d, a) => {
            const dv = d.devis.find((x) => x.id === id);
            if (dv?.commandeId)
              throw new ErpError("Ce devis a été transformé en commande : suppression impossible.");
            d.devis = d.devis.filter((x) => x.id !== id);
            log(d, a, "Devis", `Suppression du devis ${dv?.numero}`);
          }),
        duplicateDevis: (id) =>
          mutate((d, a) => {
            const src = d.devis.find((x) => x.id === id)!;
            const nid = uid("dev-");
            const numero = nextNumero(d, "devis");
            const now = new Date();
            const val = new Date(now);
            val.setDate(val.getDate() + d.settings.validiteDevisJours);
            d.devis.push({
              ...structuredClone(src),
              id: nid,
              numero,
              statut: "brouillon",
              date: now.toISOString(),
              validite: val.toISOString(),
              commandeId: undefined,
              lignes: src.lignes.map((l) => ({ ...l, id: uid("l-") })),
            });
            log(d, a, "Devis", `Duplication du devis ${src.numero} → ${numero}`);
            return nid;
          }),
        setDevisStatut: (id, s) =>
          mutate((d, a) => {
            const dv = d.devis.find((x) => x.id === id)!;
            if (dv.commandeId) throw new ErpError("Ce devis est déjà transformé en commande.");
            dv.statut = s;
            log(d, a, "Devis", `Devis ${dv.numero} : statut « ${s} »`);
            if (s === "accepte") {
              const cl = d.clients.find((c) => c.id === dv.clientId);
              notify(
                d,
                "Devis accepté",
                `Le devis ${dv.numero} (${cl?.nom}) a été accepté.`,
                "succes",
                "admin",
                `/devis/${dv.id}`,
              );
              if (dv.commercialId !== a)
                notify(
                  d,
                  "Devis accepté",
                  `Votre devis ${dv.numero} a été accepté.`,
                  "succes",
                  dv.commercialId,
                  `/devis/${dv.id}`,
                );
            }
          }),
        convertirDevis: (id) =>
          mutate((d, a) => {
            const dv = d.devis.find((x) => x.id === id)!;
            if (dv.commandeId) throw new ErpError("Ce devis a déjà été transformé en commande.");
            if (dv.statut === "refuse" || dv.statut === "expire")
              throw new ErpError("Un devis refusé ou expiré ne peut pas être transformé.");
            const cid = uid("cmd-");
            const numero = nextNumero(d, "commande");
            const now = new Date();
            const liv = new Date(now);
            liv.setDate(liv.getDate() + 7);
            const cmd: Commande = {
              id: cid,
              numero,
              clientId: dv.clientId,
              commercialId: dv.commercialId,
              date: now.toISOString(),
              dateLivraison: liv.toISOString(),
              statut: "confirmee",
              lignes: dv.lignes.map((l) => ({ ...l, id: uid("l-") })),
              tauxTVA: dv.tauxTVA,
              remiseGlobale: dv.remiseGlobale,
              notes: dv.notes,
              depotId: d.depots[0]?.id ?? "",
              devisId: dv.id,
              stockDeduit: false,
              dateConfirmation: now.toISOString(),
            };
            d.commandes.push(cmd);
            dv.statut = "accepte";
            dv.commandeId = cid;
            for (const [pid, q] of Object.entries(cartonsCommande(d, cmd)))
              d.movements.unshift({
                id: uid("mv-"),
                date: now.toISOString(),
                productId: pid,
                type: "reservation",
                quantite: q,
                unite: "carton",
                depotId: cmd.depotId,
                userId: a,
                motif: `Réservation pour la commande ${numero}`,
                commandeId: cid,
              });
            const cl = d.clients.find((c) => c.id === dv.clientId);
            log(d, a, "Commande", `Devis ${dv.numero} transformé en commande ${numero}`);
            notify(
              d,
              "Nouvelle commande créée",
              `${numero} — ${cl?.nom} — ${fmtMAD(totaux(cmd).ttc)} (depuis le devis ${dv.numero}).`,
              "info",
              "admin",
              `/commandes/${cid}`,
            );
            return cid;
          }, true),

        saveCommande: (c) =>
          mutate((d, a) => {
            if (!c.lignes.length) throw new ErpError("Ajoutez au moins un produit à la commande.");
            if (c.id) {
              const i = d.commandes.findIndex((x) => x.id === c.id);
              const cur = d.commandes[i];
              if (cur.statut === "livree" || cur.statut === "annulee")
                throw new ErpError("Une commande livrée ou annulée ne peut plus être modifiée.");
              d.commandes[i] = {
                ...cur,
                ...c,
                id: c.id,
                statut: cur.statut,
                stockDeduit: cur.stockDeduit,
              };
              log(d, a, "Commande", `Modification de la commande ${cur.numero}`);
              return c.id;
            }
            const id = uid("cmd-");
            const numero = nextNumero(d, "commande");
            const cmd: Commande = { ...c, id, numero, stockDeduit: false };
            if (STATUTS_RESERVANTS.includes(cmd.statut)) {
              cmd.dateConfirmation = new Date().toISOString();
              for (const [pid, q] of Object.entries(cartonsCommande(d, cmd)))
                d.movements.unshift({
                  id: uid("mv-"),
                  date: new Date().toISOString(),
                  productId: pid,
                  type: "reservation",
                  quantite: q,
                  unite: "carton",
                  depotId: cmd.depotId,
                  userId: a,
                  motif: `Réservation pour la commande ${numero}`,
                  commandeId: id,
                });
            }
            d.commandes.push(cmd);
            const cl = d.clients.find((x) => x.id === c.clientId);
            log(d, a, "Commande", `Création de la commande ${numero}`);
            notify(
              d,
              "Nouvelle commande créée",
              `${numero} — ${cl?.nom} — ${fmtMAD(totaux(cmd).ttc)}.`,
              "info",
              "admin",
              `/commandes/${id}`,
            );
            return id;
          }, true),
        setCommandeStatut: (id, s) =>
          mutate((d, a) => {
            const c = d.commandes.find((x) => x.id === id)!;
            const prev = c.statut;
            if (prev === s) return;
            if (prev === "livree")
              throw new ErpError("Une commande livrée ne peut plus changer de statut.");
            if (prev === "annulee")
              throw new ErpError("Une commande annulée ne peut plus changer de statut.");
            const now = new Date().toISOString();
            const ct = cartonsCommande(d, c);
            const wasReserving = STATUTS_RESERVANTS.includes(prev);
            // Confirmation : réservation automatique
            if (!wasReserving && STATUTS_RESERVANTS.includes(s)) {
              c.dateConfirmation = now;
              for (const [pid, q] of Object.entries(ct))
                d.movements.unshift({
                  id: uid("mv-"),
                  date: now,
                  productId: pid,
                  type: "reservation",
                  quantite: q,
                  unite: "carton",
                  depotId: c.depotId,
                  userId: a,
                  motif: `Réservation pour la commande ${c.numero}`,
                  commandeId: c.id,
                });
            }
            // Annulation : libération des réservations
            if (s === "annulee" && wasReserving) {
              for (const [pid, q] of Object.entries(ct))
                d.movements.unshift({
                  id: uid("mv-"),
                  date: now,
                  productId: pid,
                  type: "liberation",
                  quantite: q,
                  unite: "carton",
                  depotId: c.depotId,
                  userId: a,
                  motif: `Annulation de la commande ${c.numero}`,
                  commandeId: c.id,
                });
            }
            // Livraison : sortie physique unique (garde-fou stockDeduit)
            if (s === "livree" && !c.stockDeduit) {
              for (const [pid, q] of Object.entries(ct)) {
                if (stockPhysique(d, pid) < q) {
                  const p = d.products.find((x) => x.id === pid);
                  throw new ErpError(
                    `Stock physique insuffisant pour ${p?.nom} (${q} cartons requis).`,
                  );
                }
              }
              for (const [pid, q] of Object.entries(ct)) {
                consumeLots(d, pid, c.depotId, q);
                d.movements.unshift({
                  id: uid("mv-"),
                  date: now,
                  productId: pid,
                  type: "sortie",
                  quantite: q,
                  unite: "carton",
                  depotId: c.depotId,
                  userId: a,
                  motif: `Livraison de la commande ${c.numero}`,
                  commandeId: c.id,
                });
              }
              c.stockDeduit = true;
              c.dateLivraison = now;
            }
            c.statut = s;
            log(
              d,
              a,
              "Commande",
              `Commande ${c.numero} : ${COMMANDE_STATUTS[prev].label} → ${COMMANDE_STATUTS[s].label}`,
            );
            if (c.commercialId !== a)
              notify(
                d,
                "Mise à jour de commande",
                `${c.numero} est passée à « ${COMMANDE_STATUTS[s].label} ».`,
                s === "annulee" ? "alerte" : "info",
                c.commercialId,
                `/commandes/${c.id}`,
              );
          }, true),
        genererFacture: (cid) =>
          mutate((d, a) => {
            const c = d.commandes.find((x) => x.id === cid)!;
            if (c.factureId) throw new ErpError("Une facture existe déjà pour cette commande.");
            if (c.statut === "en_attente" || c.statut === "annulee")
              throw new ErpError("La commande doit être confirmée pour être facturée.");
            const id = uid("fac-");
            const numero = nextNumero(d, "facture");
            const now = new Date();
            const ech = new Date(now);
            ech.setDate(ech.getDate() + 30);
            const f: Facture = {
              id,
              numero,
              commandeId: c.id,
              clientId: c.clientId,
              commercialId: c.commercialId,
              date: now.toISOString(),
              echeance: ech.toISOString(),
              lignes: structuredClone(c.lignes),
              tauxTVA: c.tauxTVA,
              remiseGlobale: c.remiseGlobale,
              notes: d.settings.conditionsPaiement,
            };
            d.factures.push(f);
            c.factureId = id;
            log(d, a, "Facture", `Génération de la facture ${numero} (${fmtMAD(totaux(f).ttc)})`);
            return id;
          }),

        addPaiement: (p) =>
          mutate((d, a) => {
            const f = d.factures.find((x) => x.id === p.factureId)!;
            const { reste } = soldeFacture(d, f);
            if (p.montant <= 0) throw new ErpError("Le montant doit être supérieur à zéro.");
            if (p.montant > reste + 0.01)
              throw new ErpError(`Le montant dépasse le solde restant (${fmtMAD(reste)}).`);
            const id = uid("pay-");
            const numero = nextNumero(d, "paiement");
            const pay: Paiement = {
              ...p,
              id,
              numero,
              montant: round2(p.montant),
              clientId: f.clientId,
              userId: a,
            };
            d.paiements.push(pay);
            const cl = d.clients.find((c) => c.id === f.clientId);
            log(
              d,
              a,
              "Paiement",
              `Encaissement de ${fmtMAD(p.montant)} sur la facture ${f.numero}`,
            );
            notify(
              d,
              "Paiement reçu",
              `${fmtMAD(p.montant)} reçu de ${cl?.nom} (facture ${f.numero}).`,
              "succes",
              "admin",
              `/factures/${f.id}`,
            );
            notify(
              d,
              "Paiement reçu",
              `${fmtMAD(p.montant)} encaissé sur la facture ${f.numero} (${cl?.nom}).`,
              "succes",
              f.commercialId,
              `/factures/${f.id}`,
            );
            return id;
          }),
        deletePaiement: (id) =>
          mutate((d, a) => {
            const p = d.paiements.find((x) => x.id === id);
            d.paiements = d.paiements.filter((x) => x.id !== id);
            log(d, a, "Paiement", `Annulation du paiement ${p?.numero}`);
          }),

        markRead: (id) =>
          mutate((d) => {
            const n = d.notifications.find((x) => x.id === id);
            if (n) n.lu = true;
          }),
        markAllRead: (ids) =>
          mutate((d) => {
            for (const n of d.notifications) if (ids.includes(n.id)) n.lu = true;
          }),
        deleteNotification: (id) =>
          mutate((d) => void (d.notifications = d.notifications.filter((x) => x.id !== id))),
      };
    },
    {
      name: "erp-ceramique-demo",
      version: DATA_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ data: s.data }),
      migrate: () => ({ data: createSeed() }) as unknown as ErpState,
      onRehydrateStorage: () => () => {
        useErp.setState({ hydrated: true });
      },
    },
  ),
);

export const erpActions = () => useErp.getState();

/** Exécute une action et renvoie un message d'erreur lisible le cas échéant. */
export function tryAction<R>(fn: () => R): { ok: true; value: R } | { ok: false; error: string } {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Une erreur inattendue est survenue.",
    };
  }
}
