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
import { CLIENT_TYPES, VILLES } from "@/lib/erp/constants";
import { useCurrentUser, useData } from "@/lib/erp/hooks";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Client, ClientType } from "@/lib/erp/types";

type Form = Omit<Client, "id" | "dateCreation">;

const empty = (commercialId: string): Form => ({
  nom: "",
  type: "Particulier",
  telephone: "",
  email: "",
  adresse: "",
  ville: "Casablanca",
  commercialId,
  ice: "",
});

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client?: Client;
  onSaved?: (id: string) => void;
}) {
  const data = useData();
  const user = useCurrentUser();
  const isAdmin = user.role === "admin";
  const saveClient = useErp((s) => s.saveClient);
  const commerciaux = data.users.filter(
    (u) => u.role === "commercial" && (u.actif || u.id === client?.commercialId),
  );
  const defaultCommercial = isAdmin ? (commerciaux[0]?.id ?? "") : user.id;
  const [f, setF] = useState<Form>(empty(defaultCommercial));
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setF(client ? { ...client, ice: client.ice ?? "" } : empty(defaultCommercial));
      setErr({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const villes = [...new Set([...VILLES, ...data.clients.map((c) => c.ville)])].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.nom.trim().length < 2) e.nom = "Le nom du client est obligatoire.";
    if (!/^[+\d][\d\s.-]{7,}$/.test(f.telephone.trim()))
      e.telephone = "Numéro de téléphone invalide.";
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
      e.email = "Adresse e-mail invalide.";
    if (!f.ville.trim()) e.ville = "La ville est obligatoire.";
    if (f.ice && !/^\d{15}$/.test(f.ice.trim())) e.ice = "L'ICE doit comporter 15 chiffres.";
    if (!f.commercialId) e.commercialId = "Sélectionnez un commercial.";
    setErr(e);
    if (Object.keys(e).length) return;
    const payload = {
      ...f,
      nom: f.nom.trim(),
      telephone: f.telephone.trim(),
      email: f.email.trim(),
      adresse: f.adresse.trim(),
      ice: f.ice?.trim() || undefined,
      commercialId: isAdmin ? f.commercialId : (client?.commercialId ?? user.id),
      id: client?.id,
    };
    const r = tryAction(() => saveClient(payload));
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(client ? "Fiche client mise à jour." : "Client ajouté avec succès.");
    onOpenChange(false);
    onSaved?.(r.value);
  };

  const field = (
    k: "nom" | "telephone" | "email" | "adresse" | "ice",
    label: string,
    props: Record<string, unknown> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cf-${k}`}>{label}</Label>
      <Input
        id={`cf-${k}`}
        className={cn("h-10", err[k] && "border-destructive")}
        value={f[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        {...props}
      />
      {err[k] && <p className="text-xs text-destructive">{err[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{client ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          <DialogDescription>
            Coordonnées, type de client et commercial responsable.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {field("nom", "Nom ou raison sociale", {
              placeholder: "Ex. : Résidences Al Manar SARL",
            })}
          </div>
          <div className="space-y-1.5">
            <Label>Type de client</Label>
            <Select value={f.type} onValueChange={(v) => set("type", v as ClientType)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ville</Label>
            <Select value={f.ville} onValueChange={(v) => set("ville", v)}>
              <SelectTrigger className={cn("h-10", err.ville && "border-destructive")}>
                <SelectValue placeholder="Ville" />
              </SelectTrigger>
              <SelectContent>
                {villes.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field("telephone", "Téléphone", { placeholder: "+212 6 00 00 00 00", inputMode: "tel" })}
          {field("email", "E-mail (facultatif)", {
            type: "email",
            placeholder: "contact@client.ma",
          })}
          <div className="sm:col-span-2">
            {field("adresse", "Adresse", { placeholder: "Rue, quartier" })}
          </div>
          {field("ice", "ICE (facultatif)", { placeholder: "15 chiffres", inputMode: "numeric" })}
          <div className="space-y-1.5">
            <Label>Commercial responsable</Label>
            {isAdmin ? (
              <Select value={f.commercialId} onValueChange={(v) => set("commercialId", v)}>
                <SelectTrigger className={cn("h-10", err.commercialId && "border-destructive")}>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {commerciaux.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-10"
                value={
                  data.users.find((u) => u.id === (client?.commercialId ?? user.id))?.nom ??
                  user.nom
                }
                disabled
              />
            )}
            {err.commercialId && <p className="text-xs text-destructive">{err.commercialId}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>{client ? "Enregistrer" : "Ajouter le client"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
