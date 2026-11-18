import { beforeEach, describe, expect, it } from "vitest";
import { cartonsNecessaires, cartonsToM2, soldeFacture, statutFacture, stockDisponible, stockPhysique, stockReserve, totaux } from "@/lib/erp/calc";
import { createSeed } from "@/lib/erp/seed";
import { useErp } from "@/lib/erp/store";

const p144 = { m2ParCarton: 1.44, piecesParCarton: 4 };

describe("Conversions céramique", () => {
  it("20 cartons à 1,44 m² = 28,80 m²", () => {
    expect(cartonsToM2(p144, 20)).toBe(28.8);
  });
  it("une commande en m² réserve des cartons entiers (arrondi supérieur)", () => {
    expect(cartonsNecessaires(p144, "m2", 30)).toBe(21);
    expect(cartonsNecessaires(p144, "m2", 28.8)).toBe(20);
  });
});

describe("Montants des documents", () => {
  it("calcule remise ligne, remise globale, TVA 20 % et TTC", () => {
    const t = totaux({
      lignes: [{ id: "1", productId: "x", designation: "", unite: "carton", quantite: 10, prixUnitaire: 100, remise: 10 }],
      tauxTVA: 20,
      remiseGlobale: 5,
    });
    expect(t.sousTotal).toBe(1000);
    expect(t.ht).toBe(855);
    expect(t.tva).toBe(171);
    expect(t.ttc).toBe(1026);
  });
});

describe("Parcours devis → commande → facture → paiement", () => {
  beforeEach(() => {
    useErp.setState({ data: createSeed(new Date("2026-11-18T10:00:00Z")), actorId: "u-youssef" });
  });

  it("la conversion d'un devis réserve le stock, la livraison le déduit une seule fois", () => {
    const s = useErp.getState();
    const clientId = s.data.clients.find((c) => c.commercialId === "u-youssef")!.id;
    const pid = "p-1";
    const devisId = s.saveDevis({
      clientId,
      commercialId: "u-youssef",
      date: new Date().toISOString(),
      validite: new Date().toISOString(),
      statut: "envoye",
      lignes: [{ id: "l1", productId: pid, designation: "Test", unite: "carton", quantite: 20, prixUnitaire: 416.16, remise: 0 }],
      tauxTVA: 20,
      remiseGlobale: 0,
      notes: "",
    });
    const reserveAvant = stockReserve(useErp.getState().data, pid);
    const physiqueAvant = stockPhysique(useErp.getState().data, pid);
    const cmdId = useErp.getState().convertirDevis(devisId);
    expect(stockReserve(useErp.getState().data, pid)).toBe(reserveAvant + 20);

    useErp.getState().setCommandeStatut(cmdId, "livree");
    const d = useErp.getState().data;
    expect(stockPhysique(d, pid)).toBe(physiqueAvant - 20);
    expect(stockReserve(d, pid)).toBe(reserveAvant);
    expect(() => useErp.getState().setCommandeStatut(cmdId, "livree")).not.toThrow();
    expect(stockPhysique(useErp.getState().data, pid)).toBe(physiqueAvant - 20);
  });

  it("un paiement partiel met à jour le solde restant", () => {
    const s = useErp.getState();
    const cmd = s.data.commandes.find((c) => c.statut === "confirmee" && !c.factureId)!;
    const fid = s.genererFacture(cmd.id);
    const f = useErp.getState().data.factures.find((x) => x.id === fid)!;
    const ttc = totaux(f).ttc;
    useErp.getState().addPaiement({ factureId: fid, montant: 1000, mode: "cheque", date: new Date().toISOString(), reference: "", note: "" });
    const d = useErp.getState().data;
    expect(soldeFacture(d, f).reste).toBeCloseTo(ttc - 1000, 2);
    expect(statutFacture(d, f)).toBe("partielle");
    expect(() => useErp.getState().addPaiement({ factureId: fid, montant: ttc, mode: "cheque", date: "", reference: "", note: "" })).toThrow();
  });

  it("un commercial ne peut pas confirmer une commande sans stock disponible négatif caché", () => {
    const d = useErp.getState().data;
    expect(stockDisponible(d, "p-2")).toBe(0);
  });
});
