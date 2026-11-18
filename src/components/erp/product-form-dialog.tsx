import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { round2 } from "@/lib/erp/calc";
import { CATEGORIES, FINITIONS } from "@/lib/erp/constants";
import { fmtMAD } from "@/lib/erp/format";
import { useData } from "@/lib/erp/hooks";
import { IMAGE_LIBRARY, productImage } from "@/lib/erp/images";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Product } from "@/lib/erp/types";

type Form = Omit<Product, "id" | "dateCreation">;

const empty = (fournisseurId: string): Form => ({
  image: "marbre-blanc",
  nom: "",
  sku: "",
  marque: "",
  collection: "",
  categorie: "Grès cérame",
  dimension: "60 × 60 cm",
  couleur: "",
  finition: "Mat",
  matiere: "Grès cérame",
  prixM2: 0,
  prixCarton: 0,
  m2ParCarton: 1.44,
  piecesParCarton: 4,
  seuilMin: 30,
  fournisseurId,
  description: "",
});

/** Redimensionne une image importée pour limiter la taille stockée. */
const resize = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 480;
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * r;
        c.height = img.height * r;
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: Product;
}) {
  const data = useData();
  const saveProduct = useErp((s) => s.saveProduct);
  const [f, setF] = useState<Form>(empty(data.suppliers[0]?.id ?? ""));
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setF(product ? { ...product } : empty(data.suppliers[0]?.id ?? ""));
      setErr({});
    }
  }, [open, product, data.suppliers]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const isAcc = f.categorie === "Accessoires";

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.nom.trim()) e.nom = "Le nom est obligatoire.";
    if (!f.sku.trim()) e.sku = "La référence SKU est obligatoire.";
    if (!isAcc && f.prixM2 <= 0) e.prixM2 = "Indiquez un prix au m².";
    if (isAcc && f.prixCarton <= 0) e.prixCarton = "Indiquez un prix par carton.";
    if (!isAcc && f.m2ParCarton <= 0) e.m2ParCarton = "Valeur requise.";
    setErr(e);
    if (Object.keys(e).length) return;
    const payload = {
      ...f,
      prixCarton: isAcc ? f.prixCarton : round2(f.prixM2 * f.m2ParCarton),
      m2ParCarton: isAcc ? 0 : f.m2ParCarton,
      prixM2: isAcc ? 0 : f.prixM2,
      id: product?.id,
    };
    const r = tryAction(() => saveProduct(payload));
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(product ? "Produit modifié." : "Produit ajouté au catalogue.");
    onOpenChange(false);
  };

  const field = (
    k: keyof Form,
    label: string,
    type: "text" | "number" = "text",
    props: Record<string, unknown> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`pf-${k}`}>{label}</Label>
      <Input
        id={`pf-${k}`}
        type={type}
        className={cn("h-10", err[k] && "border-destructive")}
        value={f[k] as string | number}
        onChange={(e) =>
          set(k, (type === "number" ? Number(e.target.value) : e.target.value) as never)
        }
        {...props}
      />
      {err[k] && <p className="text-xs text-destructive">{err[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          <DialogDescription>
            Le prix par carton est calculé automatiquement à partir du prix au m² et de la surface
            par carton.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>Image du produit</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(IMAGE_LIBRARY).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  title={v.label}
                  onClick={() => set("image", k)}
                  className={cn(
                    "size-14 overflow-hidden rounded-md border-2 transition",
                    f.image === k
                      ? "border-primary"
                      : "border-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  <img src={v.src} alt={v.label} className="h-full w-full object-cover" />
                </button>
              ))}
              {f.image.startsWith("data:") && (
                <span className="size-14 overflow-hidden rounded-md border-2 border-primary">
                  <img
                    src={productImage(f.image)}
                    alt="Image importée"
                    className="h-full w-full object-cover"
                  />
                </span>
              )}
              <label
                className="flex size-14 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-muted-foreground hover:text-foreground"
                title="Importer une photo"
              >
                <ImagePlus className="size-5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) set("image", await resize(file));
                  }}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field("nom", "Nom du produit")}
            {field("sku", "Référence SKU")}
            {field("marque", "Marque")}
            {field("collection", "Collection")}
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select
                value={f.categorie}
                onValueChange={(v) => set("categorie", v as Form["categorie"])}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dimensions</Label>
              <Select value={f.dimension} onValueChange={(v) => set("dimension", v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...data.dimensions, f.dimension])].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Finition</Label>
              <Select
                value={f.finition}
                onValueChange={(v) => set("finition", v as Form["finition"])}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("couleur", "Couleur")}
            {field("matiere", "Matière")}
            <div className="space-y-1.5">
              <Label>Fournisseur</Label>
              <Select value={f.fournisseurId} onValueChange={(v) => set("fournisseurId", v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
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
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="mb-3 text-sm font-medium">Conditionnement et prix</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {!isAcc && field("prixM2", "Prix au m² (DH HT)", "number", { min: 0, step: "0.01" })}
              {!isAcc && field("m2ParCarton", "m² par carton", "number", { min: 0, step: "0.01" })}
              {isAcc &&
                field("prixCarton", "Prix par carton (DH HT)", "number", { min: 0, step: "0.01" })}
              {field("piecesParCarton", "Pièces par carton", "number", { min: 1 })}
              {field("seuilMin", "Seuil minimal (cartons)", "number", { min: 0 })}
              {!isAcc && (
                <div className="space-y-1.5">
                  <Label>Prix par carton (calculé)</Label>
                  <p className="flex h-10 items-center rounded-md border bg-card px-3 text-sm font-semibold tabular">
                    {fmtMAD(round2(f.prixM2 * f.m2ParCarton))}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>{product ? "Enregistrer" : "Ajouter le produit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
