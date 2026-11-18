import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cartonsNecessaires,
  cartonsToM2,
  cartonsToPieces,
  round2,
  stockDisponible,
  stockPhysique,
} from "@/lib/erp/calc";
import { fmtMAD, fmtQty } from "@/lib/erp/format";
import { useData } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Product } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

export type StockAction = "entree" | "sortie" | "transfert" | "inventaire";

const TITRES: Record<StockAction, { titre: string; desc: string; bouton: string }> = {
  entree: {
    titre: "Entrée de stock",
    desc: "Réception de marchandise : le lot, le calibre et la tonalité sont enregistrés pour garantir l'homogénéité des chantiers.",
    bouton: "Enregistrer l'entrée",
  },
  sortie: {
    titre: "Sortie de stock",
    desc: "Sortie manuelle (casse, échantillons, usage interne…). Les lots les plus anciens sont consommés en premier.",
    bouton: "Enregistrer la sortie",
  },
  transfert: {
    titre: "Transfert entre dépôts",
    desc: "Déplacez des cartons d'un dépôt à un autre en conservant les informations de lot.",
    bouton: "Valider le transfert",
  },
  inventaire: {
    titre: "Inventaire",
    desc: "Saisissez le nombre de cartons comptés : l'écart avec le stock théorique est ajusté automatiquement.",
    bouton: "Valider l'inventaire",
  },
};

/** Bandeau de conversion cartons ↔ m² ↔ pièces. */
export function ConversionHint({
  product,
  cartons,
  className,
}: {
  product?: Product;
  cartons: number;
  className?: string;
}) {
  if (!product) return null;
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-2 rounded-lg bg-accent/60 p-3 text-center text-xs",
        className,
      )}
    >
      <div>
        <p className="text-base font-semibold tabular text-foreground">{fmtQty(cartons)}</p>
        <p className="text-muted-foreground">cartons</p>
      </div>
      <div>
        <p className="text-base font-semibold tabular text-foreground">
          {product.m2ParCarton > 0 ? fmtQty(cartonsToM2(product, cartons)) : "—"}
        </p>
        <p className="text-muted-foreground">m²</p>
      </div>
      <div>
        <p className="text-base font-semibold tabular text-foreground">
          {fmtQty(cartonsToPieces(product, cartons))}
        </p>
        <p className="text-muted-foreground">pièces</p>
      </div>
    </div>
  );
}

export function ProductSelect({
  value,
  onChange,
  products,
}: {
  value: string;
  onChange: (v: string) => void;
  products: Product[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 bg-card">
        <SelectValue placeholder="Sélectionner un produit" />
      </SelectTrigger>
      <SelectContent>
        {products.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <img src={productImage(p.image)} alt="" className="size-5 rounded object-cover" />
              {p.nom} · {p.dimension}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StockActionDialog({
  action,
  onOpenChange,
  productId: initialProduct,
}: {
  action: StockAction | null;
  onOpenChange: (o: boolean) => void;
  productId?: string;
}) {
  const data = useData();
  const store = useErp.getState();
  const [productId, setProductId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [depotDest, setDepotDest] = useState("");
  const [cartons, setCartons] = useState(0);
  const [lot, setLot] = useState("");
  const [calibre, setCalibre] = useState("C1");
  const [tonalite, setTonalite] = useState("T01");
  const [refFab, setRefFab] = useState("");
  const [fournisseurId, setFournisseurId] = useState("");
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action) return;
    const pid = initialProduct ?? "";
    const p = data.products.find((x) => x.id === pid);
    setProductId(pid);
    setDepotId(data.depots[0]?.id ?? "");
    setDepotDest(data.depots[1]?.id ?? "");
    setCartons(0);
    setLot(
      `L${new Date().getFullYear().toString().slice(2)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    );
    setCalibre("C1");
    setTonalite("T01");
    setRefFab("");
    setFournisseurId(p?.fournisseurId ?? "");
    setMotif("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, initialProduct]);

  const product = data.products.find((p) => p.id === productId);
  const physDepot = product && depotId ? stockPhysique(data, product.id, depotId) : 0;
  const ecart = action === "inventaire" ? cartons - physDepot : 0;
  const t = action ? TITRES[action] : TITRES.entree;

  const submit = () => {
    setError(null);
    if (!productId) return setError("Sélectionnez un produit.");
    if (!depotId) return setError("Sélectionnez un dépôt.");
    if (action !== "inventaire" && (!cartons || cartons <= 0))
      return setError("La quantité doit être supérieure à zéro.");
    if (action === "inventaire" && cartons < 0)
      return setError("Le comptage ne peut pas être négatif.");
    if (action === "entree" && !lot.trim()) return setError("Le numéro de lot est obligatoire.");
    if (action === "transfert" && depotId === depotDest)
      return setError("Les dépôts de départ et d'arrivée doivent être différents.");
    const r = tryAction(() => {
      if (action === "entree")
        store.entreeStock({
          productId,
          depotId,
          cartons,
          lot: lot.trim(),
          calibre,
          tonalite,
          refFabrication: refFab.trim() || "—",
          fournisseurId: fournisseurId || undefined,
          motif: motif.trim() || "Réception fournisseur",
        });
      else if (action === "sortie")
        store.sortieStock({
          productId,
          depotId,
          cartons,
          motif: motif.trim() || "Sortie manuelle",
        });
      else if (action === "transfert")
        store.transfertStock({
          productId,
          from: depotId,
          to: depotDest,
          cartons,
          motif: motif.trim() || "Transfert entre dépôts",
        });
      else if (action === "inventaire")
        store.inventaire({ productId, depotId, compte: cartons, motif: motif.trim() });
    });
    if (!r.ok) return setError(r.error);
    toast.success(
      action === "inventaire" && ecart === 0
        ? "Inventaire conforme : aucun écart constaté."
        : `${t.titre} enregistrée.`,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.titre}</DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Produit</Label>
            <ProductSelect
              value={productId}
              products={data.products}
              onChange={(v) => {
                setProductId(v);
                const p = data.products.find((x) => x.id === v);
                if (p) setFournisseurId(p.fournisseurId);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{action === "transfert" ? "Dépôt de départ" : "Dépôt"}</Label>
            <Select value={depotId} onValueChange={setDepotId}>
              <SelectTrigger className="h-10 bg-card">
                <SelectValue placeholder="Dépôt" />
              </SelectTrigger>
              <SelectContent>
                {data.depots.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {action === "transfert" ? (
            <div className="space-y-1.5">
              <Label>Dépôt d'arrivée</Label>
              <Select value={depotDest} onValueChange={setDepotDest}>
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue placeholder="Dépôt" />
                </SelectTrigger>
                <SelectContent>
                  {data.depots.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{action === "inventaire" ? "Cartons comptés" : "Quantité (cartons)"}</Label>
              <Input
                type="number"
                min={0}
                className="h-10 bg-card tabular"
                value={cartons}
                onChange={(e) => setCartons(Math.max(0, Math.round(Number(e.target.value))))}
              />
            </div>
          )}
          {action === "transfert" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Quantité (cartons)</Label>
              <Input
                type="number"
                min={0}
                className="h-10 bg-card tabular"
                value={cartons}
                onChange={(e) => setCartons(Math.max(0, Math.round(Number(e.target.value))))}
              />
            </div>
          )}
          {action === "entree" && (
            <>
              <div className="space-y-1.5">
                <Label>N° de lot</Label>
                <Input
                  className="h-10 bg-card"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Réf. fabrication</Label>
                <Input
                  className="h-10 bg-card"
                  value={refFab}
                  onChange={(e) => setRefFab(e.target.value)}
                  placeholder="Ex. FAB-2026-118"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Calibre</Label>
                <Select value={calibre} onValueChange={setCalibre}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["C1", "C2", "C3", "C4"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tonalité</Label>
                <Select value={tonalite} onValueChange={setTonalite}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["T01", "T02", "T03", "T04", "T05"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Fournisseur</Label>
                <Select value={fournisseurId} onValueChange={setFournisseurId}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue placeholder="Fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Motif {action === "inventaire" ? "(facultatif)" : ""}</Label>
            <Input
              className="h-10 bg-card"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={
                action === "entree"
                  ? "Réception conteneur, bon de livraison…"
                  : action === "sortie"
                    ? "Casse, échantillons, showroom…"
                    : action === "transfert"
                      ? "Approvisionnement du showroom…"
                      : "Inventaire mensuel"
              }
            />
          </div>
        </div>

        {product && (
          <div className="space-y-2">
            <ConversionHint product={product} cartons={cartons} />
            <p className="text-xs text-muted-foreground">
              Stock physique dans ce dépôt :{" "}
              <b className="text-foreground tabular">{physDepot} cartons</b> · disponible tous
              dépôts : {stockDisponible(data, product.id)} cartons
            </p>
            {action === "inventaire" && (
              <p
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  ecart === 0
                    ? "bg-success-soft text-success"
                    : ecart > 0
                      ? "bg-info-soft text-info"
                      : "bg-warning-soft text-warning-foreground",
                )}
              >
                Écart d'inventaire : {ecart > 0 ? "+" : ""}
                {ecart} cartons{" "}
                {product.m2ParCarton > 0 &&
                  `(${ecart > 0 ? "+" : ""}${fmtQty(cartonsToM2(product, ecart))} m²)`}
              </p>
            )}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>{t.bouton}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Source = "m2" | "carton" | "piece";

/** Convertisseur interactif cartons / m² / pièces avec arrondi au carton supérieur. */
export function ConverterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const data = useData();
  const tiles = useMemo(() => data.products.filter((p) => p.m2ParCarton > 0), [data.products]);
  const [productId, setProductId] = useState("");
  const [source, setSource] = useState<Source>("m2");
  const [valeur, setValeur] = useState(30);
  const [chute, setChute] = useState(10);

  useEffect(() => {
    if (open && !productId && tiles[0]) setProductId(tiles[0].id);
  }, [open, productId, tiles]);

  const p = tiles.find((x) => x.id === productId);
  const res = useMemo(() => {
    if (!p) return null;
    const base = source === "m2" ? valeur * (1 + chute / 100) : valeur;
    const cartons = cartonsNecessaires(p, source, base);
    return {
      besoinM2:
        source === "m2"
          ? round2(base)
          : source === "carton"
            ? cartonsToM2(p, valeur)
            : round2((valeur / p.piecesParCarton) * p.m2ParCarton),
      cartons,
      m2: cartonsToM2(p, cartons),
      pieces: cartonsToPieces(p, cartons),
      prix: round2(cartons * p.prixCarton),
      dispo: stockDisponible(data, p.id),
    };
  }, [p, source, valeur, chute, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convertisseur cartons / m² / pièces</DialogTitle>
          <DialogDescription>
            Calculez instantanément le nombre de cartons à prévoir pour une surface, avec marge de
            coupe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produit</Label>
            <ProductSelect value={productId} onChange={setProductId} products={tiles} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Je connais</Label>
              <Select value={source} onValueChange={(v) => setSource(v as Source)}>
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">La surface (m²)</SelectItem>
                  <SelectItem value="carton">Les cartons</SelectItem>
                  <SelectItem value="piece">Les pièces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantité</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="h-10 bg-card tabular"
                value={valeur}
                onChange={(e) => setValeur(Math.max(0, Number(e.target.value)))}
              />
            </div>
            {source === "m2" && (
              <div className="space-y-1.5">
                <Label>Marge de coupe (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  className="h-10 bg-card tabular"
                  value={chute}
                  onChange={(e) => setChute(Math.min(30, Math.max(0, Number(e.target.value))))}
                />
              </div>
            )}
          </div>
          {p && res && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-primary p-3 text-primary-foreground">
                  <p className="text-2xl font-semibold tabular">{fmtQty(res.cartons)}</p>
                  <p className="text-xs opacity-80">cartons</p>
                </div>
                <div className="rounded-lg bg-accent p-3">
                  <p className="text-2xl font-semibold tabular">{fmtQty(res.m2)}</p>
                  <p className="text-xs text-muted-foreground">m² couverts</p>
                </div>
                <div className="rounded-lg bg-accent p-3">
                  <p className="text-2xl font-semibold tabular">{fmtQty(res.pieces)}</p>
                  <p className="text-xs text-muted-foreground">pièces</p>
                </div>
              </div>
              <dl className="space-y-1.5 rounded-lg border p-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Conditionnement</dt>
                  <dd className="tabular">
                    {fmtQty(p.m2ParCarton)} m² · {p.piecesParCarton} pièces / carton
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Surface nécessaire{source === "m2" && chute ? " (avec marge)" : ""}
                  </dt>
                  <dd className="tabular">{fmtQty(res.besoinM2)} m²</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Surplus (arrondi au carton)</dt>
                  <dd className="tabular">{fmtQty(round2(res.m2 - res.besoinM2))} m²</dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt>Prix estimé HT</dt>
                  <dd className="tabular">{fmtMAD(res.prix)}</dd>
                </div>
              </dl>
              <p
                className={cn(
                  "rounded-md px-3 py-2 text-xs font-medium",
                  res.cartons > res.dispo
                    ? "bg-destructive-soft text-destructive"
                    : "bg-success-soft text-success",
                )}
              >
                {res.cartons > res.dispo
                  ? `Stock insuffisant : ${res.dispo} cartons disponibles.`
                  : `Disponible immédiatement : ${res.dispo} cartons en stock.`}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
