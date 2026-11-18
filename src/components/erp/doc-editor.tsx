import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { totaux } from "@/lib/erp/calc";
import { fmtMAD, fromInputDate, toInputDate } from "@/lib/erp/format";
import { useScoped } from "@/lib/erp/hooks";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Commande, CommandeStatut, Devis, DevisStatut, LigneDoc } from "@/lib/erp/types";
import { LineItemsEditor } from "./line-items-editor";
import { SectionCard } from "./section-card";

type Props = { kind: "devis"; existing?: Devis; clientId?: string } | { kind: "commande"; existing?: Commande; clientId?: string };

const plusJours = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

export function DocEditor(props: Props) {
  const { kind, existing } = props;
  const { data, user, isAdmin, clients } = useScoped();
  const saveDevis = useErp((s) => s.saveDevis);
  const saveCommande = useErp((s) => s.saveCommande);
  const navigate = useNavigate();
  const st = data.settings;
  const commerciaux = data.users.filter((u) => u.role === "commercial" && u.actif);

  const [clientId, setClientId] = useState(existing?.clientId ?? props.clientId ?? "");
  const [commercialId, setCommercialId] = useState(existing?.commercialId ?? (isAdmin ? "" : user.id));
  const [date, setDate] = useState(toInputDate(existing?.date ?? new Date().toISOString()));
  const [echeance, setEcheance] = useState(
    toInputDate(kind === "devis" ? ((existing as Devis | undefined)?.validite ?? plusJours(st.validiteDevisJours)) : ((existing as Commande | undefined)?.dateLivraison ?? plusJours(7))),
  );
  const [depotId, setDepotId] = useState((existing as Commande | undefined)?.depotId ?? data.depots[0]?.id ?? "");
  const [statut, setStatut] = useState<string>(existing?.statut ?? (kind === "devis" ? "brouillon" : "confirmee"));
  const [tauxTVA, setTauxTVA] = useState(existing?.tauxTVA ?? st.tauxTVA);
  const [remiseGlobale, setRemiseGlobale] = useState(existing?.remiseGlobale ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? (kind === "devis" ? "Délai de livraison : 5 à 7 jours ouvrables selon disponibilité." : ""));
  const [lignes, setLignes] = useState<LigneDoc[]>(existing?.lignes ?? []);
  const [errors, setErrors] = useState<string[]>([]);

  const t = useMemo(() => totaux({ lignes, tauxTVA, remiseGlobale }), [lignes, tauxTVA, remiseGlobale]);

  // Le commercial du client est proposé par défaut
  const onClient = (id: string) => {
    setClientId(id);
    const c = data.clients.find((x) => x.id === id);
    if (isAdmin && c) setCommercialId(c.commercialId);
  };

  const submit = () => {
    const errs: string[] = [];
    if (!clientId) errs.push("Sélectionnez un client.");
    if (!commercialId) errs.push("Sélectionnez le commercial responsable.");
    const valid = lignes.filter((l) => l.productId && l.quantite > 0);
    if (!valid.length) errs.push("Ajoutez au moins un produit avec une quantité.");
    setErrors(errs);
    if (errs.length) return;
    const base = { clientId, commercialId, date: fromInputDate(date), lignes: valid, tauxTVA, remiseGlobale, notes };
    const r =
      kind === "devis"
        ? tryAction(() => saveDevis({ ...base, id: existing?.id, validite: fromInputDate(echeance), statut: statut as DevisStatut, commandeId: (existing as Devis | undefined)?.commandeId }))
        : tryAction(() =>
            saveCommande({
              ...base,
              id: existing?.id,
              dateLivraison: fromInputDate(echeance),
              statut: statut as CommandeStatut,
              depotId,
              devisId: (existing as Commande | undefined)?.devisId,
              factureId: (existing as Commande | undefined)?.factureId,
            }),
          );
    if (!r.ok) return toast.error(r.error);
    toast.success(existing ? "Modifications enregistrées." : kind === "devis" ? "Devis créé avec succès." : "Commande créée avec succès.");
    if (kind === "devis") navigate({ to: "/devis/$id", params: { id: r.value } });
    else navigate({ to: "/commandes/$id", params: { id: r.value } });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <SectionCard title="Informations générales">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={onClient}>
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom} — {c.ville}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Commercial responsable</Label>
                <Select value={commercialId} onValueChange={setCommercialId}>
                  <SelectTrigger className="h-10 bg-card">
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
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{kind === "devis" ? "Date du devis" : "Date de commande"}</Label>
              <Input type="date" className="h-10 bg-card" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{kind === "devis" ? "Date de validité" : "Livraison prévue"}</Label>
              <Input type="date" className="h-10 bg-card" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
            </div>
            {kind === "commande" && (
              <div className="space-y-1.5">
                <Label>Dépôt de préparation</Label>
                <Select value={depotId} onValueChange={setDepotId}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.depots.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nom} — {d.ville}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!existing && (
              <div className="space-y-1.5">
                <Label>Statut initial</Label>
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger className="h-10 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kind === "devis" ? (
                      <>
                        <SelectItem value="brouillon">Brouillon</SelectItem>
                        <SelectItem value="envoye">Envoyé au client</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="en_attente">En attente</SelectItem>
                        <SelectItem value="confirmee">Confirmée (réserve le stock)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Produits" description="Choisissez l'unité de vente : les équivalences cartons / m² / pièces sont calculées automatiquement.">
          <LineItemsEditor lignes={lignes} onChange={setLignes} remiseMax={st.remiseMax} />
        </SectionCard>

        <SectionCard title="Notes et conditions">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions particulières, délais, remarques…" className="bg-card" />
        </SectionCard>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <SectionCard title="Récapitulatif">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>TVA (%)</Label>
              <Input type="number" min={0} max={30} className="h-10 bg-card tabular" value={tauxTVA} onChange={(e) => setTauxTVA(Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Remise globale (%)</Label>
              <Input type="number" min={0} max={st.remiseMax} className="h-10 bg-card tabular" value={remiseGlobale} onChange={(e) => setRemiseGlobale(Math.min(st.remiseMax, Math.max(0, Number(e.target.value))))} />
            </div>
          </div>
          <dl className="mt-5 space-y-2 text-sm tabular">
            <div className="flex justify-between"><dt className="text-muted-foreground">Sous-total</dt><dd>{fmtMAD(t.sousTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Remises</dt><dd>− {fmtMAD(t.remise)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Montant HT</dt><dd className="font-medium">{fmtMAD(t.ht)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">TVA ({tauxTVA} %)</dt><dd>{fmtMAD(t.tva)}</dd></div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-primary px-3 py-2.5 text-primary-foreground">
              <dt className="font-medium">Montant TTC</dt>
              <dd className="text-lg font-semibold">{fmtMAD(t.ttc)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Remise maximale autorisée : {st.remiseMax} %.</p>
          {errors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Button className="mt-5 h-11 w-full" onClick={submit}>
            <Save /> {existing ? "Enregistrer les modifications" : kind === "devis" ? "Créer le devis" : "Créer la commande"}
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}
