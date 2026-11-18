import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Supplier } from "@/lib/erp/types";

type Form = Omit<Supplier, "id">;
const empty: Form = {
  nom: "",
  contact: "",
  telephone: "",
  email: "",
  adresse: "",
  ville: "",
  pays: "Maroc",
};

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier?: Supplier;
}) {
  const saveSupplier = useErp((s) => s.saveSupplier);
  const [f, setF] = useState<Form>(empty);
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setF(supplier ? { ...supplier } : empty);
      setErr({});
    }
  }, [open, supplier]);

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.nom.trim().length < 2) e.nom = "La raison sociale est obligatoire.";
    if (!f.contact.trim()) e.contact = "Indiquez un interlocuteur.";
    if (!/^[+\d][\d\s.-]{7,}$/.test(f.telephone.trim()))
      e.telephone = "Numéro de téléphone invalide.";
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
      e.email = "Adresse e-mail invalide.";
    if (!f.ville.trim()) e.ville = "La ville est obligatoire.";
    if (!f.pays.trim()) e.pays = "Le pays est obligatoire.";
    setErr(e);
    if (Object.keys(e).length) return;
    const r = tryAction(() => saveSupplier({ ...f, id: supplier?.id }));
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(supplier ? "Fournisseur mis à jour." : "Fournisseur ajouté.");
    onOpenChange(false);
  };

  const field = (k: keyof Form, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`sf-${k}`}>{label}</Label>
      <Input
        id={`sf-${k}`}
        className={cn("h-10", err[k] && "border-destructive")}
        value={f[k]}
        onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}
        {...props}
      />
      {err[k] && <p className="text-xs text-destructive">{err[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          <DialogDescription>Coordonnées du fabricant ou du distributeur.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {field("nom", "Raison sociale", { placeholder: "Ex. : Céramique Atlas SARL" })}
          </div>
          {field("contact", "Interlocuteur")}
          {field("telephone", "Téléphone", { inputMode: "tel" })}
          <div className="sm:col-span-2">{field("email", "E-mail", { type: "email" })}</div>
          <div className="sm:col-span-2">{field("adresse", "Adresse")}</div>
          {field("ville", "Ville")}
          {field("pays", "Pays")}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>{supplier ? "Enregistrer" : "Ajouter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
