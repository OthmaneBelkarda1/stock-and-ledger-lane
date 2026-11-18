import { forwardRef } from "react";
import { cartonsToM2, ligneNet, toCartons, totaux } from "@/lib/erp/calc";
import { UNITE_LABELS } from "@/lib/erp/constants";
import { fmtDate, fmtMAD, fmtNum, fmtQty } from "@/lib/erp/format";
import { useData } from "@/lib/erp/hooks";
import type { Client, LigneDoc } from "@/lib/erp/types";
import { CompanyLogo } from "./company-brand";

export interface DocumentInfo {
  type: "DEVIS" | "BON DE COMMANDE" | "FACTURE";
  numero: string;
  date: string;
  client?: Client;
  commercial?: string;
  meta: { label: string; value: string }[];
  lignes: LigneDoc[];
  tauxTVA: number;
  remiseGlobale: number;
  notes?: string;
  paiement?: { paye: number; reste: number };
}

/** Aperçu A4 professionnel (impression / PDF) avec les coordonnées de la société cliente. */
export const DocumentView = forwardRef<HTMLDivElement, { doc: DocumentInfo }>(function DocumentView({ doc }, ref) {
  const data = useData();
  const s = data.settings.societe;
  const t = totaux(doc);
  return (
    <div className="overflow-x-auto rounded-xl border bg-muted/40 p-2 sm:p-6">
      <div ref={ref} className="print-root mx-auto w-[794px] min-h-[1000px] bg-card p-12 text-[12px] leading-relaxed text-foreground shadow-elevated">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <CompanyLogo className="size-14" />
            <div>
              <p className="text-base font-semibold">{s.nom}</p>
              <p className="text-muted-foreground">{s.slogan}</p>
              <p className="mt-1 text-muted-foreground">
                {s.adresse}, {s.ville}
              </p>
              <p className="text-muted-foreground">
                {s.telephone} · {s.email}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl tracking-wide text-primary">{doc.type}</p>
            <p className="mt-1 font-semibold tabular">N° {doc.numero}</p>
            <p className="text-muted-foreground">Date : {fmtDate(doc.date)}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="rounded-lg border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Informations</p>
            <dl className="mt-2 space-y-0.5">
              {doc.meta.map((m) => (
                <div key={m.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{m.label}</dt>
                  <dd className="text-right font-medium">{m.value}</dd>
                </div>
              ))}
              {doc.commercial && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Commercial</dt>
                  <dd className="font-medium">{doc.commercial}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="rounded-lg bg-accent/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
            {doc.client ? (
              <div className="mt-2">
                <p className="font-semibold">{doc.client.nom}</p>
                <p>{doc.client.adresse}</p>
                <p>{doc.client.ville}, Maroc</p>
                <p className="text-muted-foreground">{doc.client.telephone}</p>
                {doc.client.ice && <p className="text-muted-foreground">ICE : {doc.client.ice}</p>}
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">—</p>
            )}
          </div>
        </div>

        <table className="mt-8 w-full border-collapse">
          <thead>
            <tr className="bg-primary text-left text-[10px] uppercase tracking-wider text-primary-foreground">
              <th className="px-3 py-2 font-semibold">Désignation</th>
              <th className="px-3 py-2 text-right font-semibold">Qté</th>
              <th className="px-3 py-2 font-semibold">Unité</th>
              <th className="px-3 py-2 text-right font-semibold">Équiv.</th>
              <th className="px-3 py-2 text-right font-semibold">P.U. HT</th>
              <th className="px-3 py-2 text-right font-semibold">Rem.</th>
              <th className="px-3 py-2 text-right font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.map((l) => {
              const p = data.products.find((x) => x.id === l.productId);
              const ct = p ? toCartons(p, l.unite, l.quantite) : 0;
              const equiv = !p || p.m2ParCarton === 0 ? "—" : l.unite === "m2" ? `${fmtQty(Math.ceil(ct - 1e-9))} ct` : `${fmtQty(cartonsToM2(p, ct))} m²`;
              return (
                <tr key={l.id} className="border-b">
                  <td className="px-3 py-2">
                    <p className="font-medium">{l.designation}</p>
                    {p && <p className="text-[10px] text-muted-foreground">Réf. {p.sku} · {p.finition}</p>}
                  </td>
                  <td className="px-3 py-2 text-right tabular">{fmtQty(l.quantite)}</td>
                  <td className="px-3 py-2">{UNITE_LABELS[l.unite]}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular">{equiv}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtNum(l.prixUnitaire)}</td>
                  <td className="px-3 py-2 text-right tabular">{l.remise ? `${l.remise} %` : "—"}</td>
                  <td className="px-3 py-2 text-right font-medium tabular">{fmtNum(ligneNet(l))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 flex justify-between gap-8">
          <div className="max-w-[340px] text-[11px] text-muted-foreground">
            {doc.notes && (
              <>
                <p className="font-semibold text-foreground">Notes & conditions</p>
                <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
              </>
            )}
          </div>
          <dl className="w-[280px] space-y-1.5 tabular">
            <div className="flex justify-between"><dt className="text-muted-foreground">Sous-total</dt><dd>{fmtMAD(t.sousTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Remises{doc.remiseGlobale ? ` (dont ${doc.remiseGlobale} % globale)` : ""}</dt><dd>− {fmtMAD(t.remise)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Total HT</dt><dd className="font-medium">{fmtMAD(t.ht)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">TVA ({doc.tauxTVA} %)</dt><dd>{fmtMAD(t.tva)}</dd></div>
            <div className="flex justify-between rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><dt>Total TTC</dt><dd>{fmtMAD(t.ttc)}</dd></div>
            {doc.paiement && (
              <>
                <div className="flex justify-between pt-1"><dt className="text-muted-foreground">Montant payé</dt><dd className="text-success">{fmtMAD(doc.paiement.paye)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Reste à payer</dt><dd>{fmtMAD(doc.paiement.reste)}</dd></div>
              </>
            )}
          </dl>
        </div>

        {doc.type === "DEVIS" && (
          <div className="mt-12 grid grid-cols-2 gap-8 text-[11px]">
            <div className="h-20 rounded-lg border border-dashed p-3 text-muted-foreground">Bon pour accord — date et signature du client</div>
            <div className="h-20 rounded-lg border border-dashed p-3 text-muted-foreground">Cachet et signature de la société</div>
          </div>
        )}

        <footer className="mt-12 border-t pt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
          {s.nom} · ICE {s.ice} · RC {s.rc} · IF {s.if} · Patente {s.patente}
          <br />
          {s.banque} · RIB {s.rib} · {s.siteWeb}
        </footer>
      </div>
    </div>
  );
});
