import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cartonsToM2, etatStock, stockDisponible, stockPhysique, stockReserve } from "@/lib/erp/calc";
import { fmtDate, fmtMAD, fmtQty } from "@/lib/erp/format";
import { useData } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import type { Product } from "@/lib/erp/types";
import { StockBadge } from "./stock-badge";

export function ProductDetailSheet({ product, onOpenChange }: { product?: Product; onOpenChange: (o: boolean) => void }) {
  const data = useData();
  const p = product;
  return (
    <Sheet open={!!p} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {p && (
          <>
            <SheetHeader>
              <SheetTitle>{p.nom}</SheetTitle>
              <SheetDescription>
                {p.sku} · {p.marque} — collection {p.collection}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-8">
              <img src={productImage(p.image)} alt={p.nom} className="aspect-[4/3] w-full rounded-lg object-cover" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold tabular">{p.prixM2 > 0 ? `${fmtMAD(p.prixM2)} / m²` : fmtMAD(p.prixCarton)}</p>
                  <p className="text-sm text-muted-foreground">{fmtMAD(p.prixCarton)} par carton (HT)</p>
                </div>
                <StockBadge dispo={stockDisponible(data, p.id)} seuil={p.seuilMin} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-4 text-sm">
                {[
                  ["Catégorie", p.categorie],
                  ["Dimensions", p.dimension],
                  ["Finition", p.finition],
                  ["Couleur", p.couleur],
                  ["Matière", p.matiere],
                  ["Fournisseur", data.suppliers.find((s) => s.id === p.fournisseurId)?.nom ?? "—"],
                  ["m² par carton", p.m2ParCarton ? `${fmtQty(p.m2ParCarton)} m²` : "—"],
                  ["Pièces par carton", String(p.piecesParCarton)],
                  ["Seuil minimal", `${p.seuilMin} cartons`],
                  ["Créé le", fmtDate(p.dateCreation)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="mb-2 text-sm font-semibold">Disponibilités</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Physique</p><p className="font-semibold tabular">{stockPhysique(data, p.id)} ct</p></div>
                  <div className="rounded-lg bg-accent p-3"><p className="text-xs text-muted-foreground">Réservé</p><p className="font-semibold tabular">{stockReserve(data, p.id)} ct</p></div>
                  <div className="rounded-lg bg-primary-soft p-3"><p className="text-xs text-muted-foreground">Disponible</p><p className="font-semibold tabular">{stockDisponible(data, p.id)} ct</p></div>
                </div>
                {p.m2ParCarton > 0 && <p className="mt-2 text-xs text-muted-foreground">Soit {fmtQty(cartonsToM2(p, Math.max(0, stockDisponible(data, p.id))))} m² disponibles à la vente.</p>}
                <ul className="mt-3 divide-y rounded-lg border text-sm">
                  {data.depots.map((d) => (
                    <li key={d.id} className="flex justify-between px-3 py-2">
                      <span>{d.nom} <span className="text-muted-foreground">— {d.ville}</span></span>
                      <span className="font-medium tabular">{stockPhysique(data, p.id, d.id)} ct</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Lots en stock</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 text-muted-foreground">
                      <tr><th className="px-3 py-2 text-left">Lot</th><th className="px-3 py-2 text-left">Calibre</th><th className="px-3 py-2 text-left">Tonalité</th><th className="px-3 py-2 text-left">Dépôt</th><th className="px-3 py-2 text-right">Cartons</th></tr>
                    </thead>
                    <tbody>
                      {data.lots.filter((l) => l.productId === p.id).map((l) => (
                        <tr key={l.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{l.numero}</td>
                          <td className="px-3 py-2">{l.calibre}</td>
                          <td className="px-3 py-2">{l.tonalite}</td>
                          <td className="px-3 py-2">{data.depots.find((d) => d.id === l.depotId)?.nom}</td>
                          <td className="px-3 py-2 text-right tabular">{l.cartons}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              <p className="text-[11px] text-muted-foreground">État : {etatStock(stockDisponible(data, p.id), p.seuilMin) === "ok" ? "stock suffisant" : "réapprovisionnement conseillé"}</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
