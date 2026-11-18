import { describe, expect, it } from "vitest";
import { ca, ventesDans } from "@/lib/erp/analytics";
import {
  plagePeriode,
  soldeFacture,
  statutFacture,
  stockDisponible,
  stockPhysique,
  totaux,
} from "@/lib/erp/calc";
import { createSeed } from "@/lib/erp/seed";
import { useErp } from "@/lib/erp/store";

describe("Parcours complet de démonstration (cahier des charges §17)", () => {
  it("client → devis → acceptation → commande → réservation → livraison → facture → paiement → statistiques", () => {
    useErp.setState({ data: createSeed(), actorId: "u-admin" });
    const s = () => useErp.getState();
    const caAvant = ca(ventesDans(s().data.commandes, plagePeriode("jour")));

    // 1. Créer un client
    const clientId = s().saveClient({
      nom: "Villa Test Anfa",
      type: "Particulier",
      telephone: "+212 6 00 00 00 00",
      email: "villa@test.ma",
      adresse: "Anfa",
      ville: "Casablanca",
      commercialId: "u-youssef",
    });

    // 2-4. Devis avec produits (30 m² d'un produit à 1,44 m²/carton) et calcul automatique
    const p = s().data.products.find(
      (x) => x.m2ParCarton === 1.44 && stockDisponible(s().data, x.id) > 50,
    )!;
    const devisId = s().saveDevis({
      clientId,
      commercialId: "u-youssef",
      date: new Date().toISOString(),
      validite: new Date(Date.now() + 15 * 864e5).toISOString(),
      statut: "envoye",
      lignes: [
        {
          id: "l1",
          productId: p.id,
          designation: p.nom,
          unite: "m2",
          quantite: 30,
          prixUnitaire: p.prixM2,
          remise: 5,
        },
      ],
      tauxTVA: 20,
      remiseGlobale: 0,
      notes: "",
    });
    const dv = s().data.devis.find((d) => d.id === devisId)!;
    const t = totaux(dv);
    expect(t.ht).toBeCloseTo(30 * p.prixM2 * 0.95, 2);
    expect(t.ttc).toBeCloseTo(t.ht * 1.2, 2);

    // 5-7. Accepter, transformer en commande : 30 m² → 21 cartons réservés
    s().setDevisStatut(devisId, "accepte");
    const dispoAvant = stockDisponible(s().data, p.id);
    const physAvant = stockPhysique(s().data, p.id);
    const cmdId = s().convertirDevis(devisId);
    expect(stockDisponible(s().data, p.id)).toBe(dispoAvant - 21);
    expect(stockPhysique(s().data, p.id)).toBe(physAvant);

    // Livraison : sortie physique
    for (const st of ["en_preparation", "prete", "livree"] as const)
      s().setCommandeStatut(cmdId, st);
    expect(stockPhysique(s().data, p.id)).toBe(physAvant - 21);

    // 8. Générer la facture
    const factureId = s().genererFacture(cmdId);
    const f = s().data.factures.find((x) => x.id === factureId)!;
    expect(totaux(f).ttc).toBe(t.ttc);

    // 9. Paiement partiel puis solde
    s().addPaiement({
      factureId,
      montant: 1000,
      mode: "cheque",
      date: new Date().toISOString(),
      reference: "CHQ-1",
      note: "",
    });
    expect(statutFacture(s().data, f)).toBe("partielle");
    s().addPaiement({
      factureId,
      montant: soldeFacture(s().data, f).reste,
      mode: "virement",
      date: new Date().toISOString(),
      reference: "VIR-1",
      note: "",
    });
    expect(statutFacture(s().data, f)).toBe("payee");

    // 10. Statistiques actualisées
    expect(ca(ventesDans(s().data.commandes, plagePeriode("jour")))).toBeCloseTo(
      caAvant + t.ttc,
      2,
    );
    expect(s().data.notifications.some((n) => n.titre === "Paiement reçu")).toBe(true);
    expect(s().data.activites[0]?.action).toBe("Paiement");
  });
});
