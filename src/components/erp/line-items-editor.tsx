import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  cartonsNecessaires,
  cartonsToM2,
  ligneNet,
  prixUnitaire,
  stockDisponible,
  toCartons,
} from "@/lib/erp/calc";
import { UNITE_LABELS } from "@/lib/erp/constants";
import { fmtMAD, fmtQty, uid } from "@/lib/erp/format";
import { useData } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import type { LigneDoc, Product, Unite } from "@/lib/erp/types";

const unitesFor = (p?: Product): Unite[] =>
  !p ? ["carton"] : p.m2ParCarton > 0 ? ["carton", "m2", "piece"] : ["carton", "piece"];

function ProductPicker({ value, onChange }: { value: string; onChange: (p: Product) => void }) {
  const data = useData();
  const [open, setOpen] = useState(false);
  const current = data.products.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-10 w-full justify-between bg-card font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            {current && (
              <img
                src={productImage(current.image)}
                alt=""
                className="size-6 rounded object-cover"
              />
            )}
            <span className="truncate">
              {current ? `${current.nom} · ${current.dimension}` : "Choisir un produit…"}
            </span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un produit, une référence…" />
          <CommandList>
            <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
            <CommandGroup>
              {data.products.map((p) => {
                const dispo = stockDisponible(data, p.id);
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.nom} ${p.sku} ${p.dimension} ${p.marque}`}
                    onSelect={() => {
                      onChange(p);
                      setOpen(false);
                    }}
                  >
                    <img
                      src={productImage(p.image)}
                      alt=""
                      className="size-8 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{p.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.sku} · {p.dimension} ·{" "}
                        <span className={cn(dispo <= p.seuilMin && "text-destructive")}>
                          {dispo} ct dispo.
                        </span>
                      </p>
                    </div>
                    {p.id === value && <Check className="size-4" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LineItemsEditor({
  lignes,
  onChange,
  remiseMax,
}: {
  lignes: LigneDoc[];
  onChange: (l: LigneDoc[]) => void;
  remiseMax: number;
}) {
  const data = useData();
  const update = (id: string, patch: Partial<LigneDoc>) =>
    onChange(lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const add = () =>
    onChange([
      ...lignes,
      {
        id: uid("l-"),
        productId: "",
        designation: "",
        unite: "carton",
        quantite: 1,
        prixUnitaire: 0,
        remise: 0,
      },
    ]);

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(0,2.4fr)_110px_100px_120px_80px_120px_36px] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
        <span>Produit</span>
        <span>Unité</span>
        <span>Quantité</span>
        <span>Prix unitaire HT</span>
        <span>Remise %</span>
        <span className="text-right">Total HT</span>
        <span />
      </div>
      {lignes.map((l) => {
        const p = data.products.find((x) => x.id === l.productId);
        const dispo = p ? stockDisponible(data, p.id) : 0;
        const besoin = p ? cartonsNecessaires(p, l.unite, l.quantite) : 0;
        return (
          <div
            key={l.id}
            className="rounded-lg border bg-muted/30 p-3 lg:border-0 lg:bg-transparent lg:p-1"
          >
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,2.4fr)_110px_100px_120px_80px_120px_36px] lg:items-center">
              <div className="col-span-2 lg:col-span-1">
                <ProductPicker
                  value={l.productId}
                  onChange={(np) => {
                    const unite = unitesFor(np).includes(l.unite) ? l.unite : "carton";
                    update(l.id, {
                      productId: np.id,
                      designation: `${np.nom} ${np.dimension}`,
                      unite,
                      prixUnitaire: prixUnitaire(np, unite),
                    });
                  }}
                />
              </div>
              <Select
                value={l.unite}
                onValueChange={(u: Unite) => {
                  if (!p) return update(l.id, { unite: u });
                  // conversion de la quantité dans la nouvelle unité
                  const ct = toCartons(p, l.unite, l.quantite);
                  const q =
                    u === "carton"
                      ? Math.ceil(ct - 1e-9)
                      : u === "m2"
                        ? cartonsToM2(p, ct)
                        : Math.round(ct * p.piecesParCarton);
                  update(l.id, { unite: u, quantite: q, prixUnitaire: prixUnitaire(p, u) });
                }}
              >
                <SelectTrigger className="h-10 bg-card" aria-label="Unité">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitesFor(p).map((u) => (
                    <SelectItem key={u} value={u}>
                      {UNITE_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                aria-label="Quantité"
                className="h-10 bg-card tabular"
                value={l.quantite}
                onChange={(e) => update(l.id, { quantite: Math.max(0, Number(e.target.value)) })}
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                aria-label="Prix unitaire"
                className="h-10 bg-card tabular"
                value={l.prixUnitaire}
                onChange={(e) =>
                  update(l.id, { prixUnitaire: Math.max(0, Number(e.target.value)) })
                }
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={remiseMax}
                aria-label="Remise"
                className="h-10 bg-card tabular"
                value={l.remise}
                onChange={(e) =>
                  update(l.id, { remise: Math.min(remiseMax, Math.max(0, Number(e.target.value))) })
                }
              />
              <p className="flex h-10 items-center justify-end text-sm font-semibold tabular">
                {fmtMAD(ligneNet(l))}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-start-2 justify-self-end text-muted-foreground hover:text-destructive lg:col-start-auto"
                onClick={() => onChange(lignes.filter((x) => x.id !== l.id))}
                aria-label="Supprimer la ligne"
              >
                <Trash2 />
              </Button>
            </div>
            {p && (
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 px-1 text-xs text-muted-foreground">
                {p.m2ParCarton > 0 && (
                  <span>
                    Équivalence :{" "}
                    <b className="font-medium text-foreground">{fmtQty(besoin)} cartons</b> ={" "}
                    {fmtQty(cartonsToM2(p, besoin))} m² · {fmtQty(besoin * p.piecesParCarton)}{" "}
                    pièces
                  </span>
                )}
                <span>{fmtQty(p.m2ParCarton)} m²/carton</span>
                <span
                  className={cn(besoin > dispo ? "font-medium text-destructive" : "text-success")}
                >
                  {besoin > dispo
                    ? `Stock insuffisant : ${dispo} cartons disponibles`
                    : `${dispo} cartons disponibles`}
                </span>
              </p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={add}
        className="w-full border-dashed sm:w-auto"
      >
        <Plus /> Ajouter un produit
      </Button>
    </div>
  );
}
