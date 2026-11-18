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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/erp/permissions";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Role, User } from "@/lib/erp/types";

type Form = Omit<User, "id">;

const empty = (): Form => ({
  nom: "",
  email: "",
  motDePasse: "",
  role: "commercial",
  telephone: "",
  dateRecrutement: new Date().toISOString(),
  actif: true,
  objectifMensuel: 120000,
});

export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user?: User;
}) {
  const saveUser = useErp((s) => s.saveUser);
  const [f, setF] = useState<Form>(empty());
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setF(user ? { ...user } : empty());
      setErr({});
    }
  }, [open, user]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.nom.trim().length < 3) e.nom = "Indiquez le nom complet.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Adresse e-mail invalide.";
    if (f.motDePasse.length < 8) e.motDePasse = "8 caractères minimum.";
    if (!/^[+\d][\d\s.-]{7,}$/.test(f.telephone.trim()))
      e.telephone = "Numéro de téléphone invalide.";
    if (f.role === "commercial" && f.objectifMensuel <= 0)
      e.objectifMensuel = "Définissez un objectif mensuel.";
    setErr(e);
    if (Object.keys(e).length) return;
    const r = tryAction(() =>
      saveUser({
        ...f,
        nom: f.nom.trim(),
        email: f.email.trim().toLowerCase(),
        telephone: f.telephone.trim(),
        objectifMensuel: f.role === "admin" ? 0 : f.objectifMensuel,
        id: user?.id,
      }),
    );
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(user ? "Compte mis à jour." : `Compte créé : ${f.email.trim().toLowerCase()}`);
    onOpenChange(false);
  };

  const field = (
    k: "nom" | "email" | "motDePasse" | "telephone",
    label: string,
    props: Record<string, unknown> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`uf-${k}`}>{label}</Label>
      <Input
        id={`uf-${k}`}
        className={cn("h-10", err[k] && "border-destructive")}
        value={f[k]}
        onChange={(e) => set(k, e.target.value)}
        {...props}
      />
      {err[k] && <p className="text-xs text-destructive">{err[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Modifier le compte" : "Nouveau collaborateur"}</DialogTitle>
          <DialogDescription>
            Accès à la plateforme et objectif commercial mensuel.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {field("nom", "Nom complet", { placeholder: "Prénom Nom" })}
          </div>
          {field("email", "E-mail de connexion", {
            type: "email",
            placeholder: "prenom.nom@demo.ma",
          })}
          {field("motDePasse", "Mot de passe", { type: "text" })}
          {field("telephone", "Téléphone", { inputMode: "tel" })}
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select value={f.role} onValueChange={(v) => set("role", v as Role)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {f.role === "commercial" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="uf-obj">Objectif mensuel (DH TTC)</Label>
              <Input
                id="uf-obj"
                type="number"
                min={0}
                step={5000}
                className={cn("h-10 tabular", err.objectifMensuel && "border-destructive")}
                value={f.objectifMensuel}
                onChange={(e) => set("objectifMensuel", Math.max(0, Number(e.target.value)))}
              />
              {err.objectifMensuel && (
                <p className="text-xs text-destructive">{err.objectifMensuel}</p>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Démonstration : les mots de passe sont stockés localement. En production, ils seront gérés
          par un service d'authentification sécurisé.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>{user ? "Enregistrer" : "Créer le compte"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
