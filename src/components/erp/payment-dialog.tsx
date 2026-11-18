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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { soldeFacture } from "@/lib/erp/calc";
import { MODES_PAIEMENT } from "@/lib/erp/constants";
import { fmtMAD, fromInputDate, toInputDate } from "@/lib/erp/format";
import { useScoped } from "@/lib/erp/hooks";
import { tryAction, useErp } from "@/lib/erp/store";
import type { ModePaiement } from "@/lib/erp/types";

/** Enregistrement d'un règlement (espèces, virement, chèque, carte) sur une facture. */
export function PaymentDialog({
  open,
  onOpenChange,
  factureId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factureId?: string;
  onSaved?: (id: string) => void;
}) {
  const { data, factures } = useScoped();
  const addPaiement = useErp((s) => s.addPaiement);
  const ouvertes = useMemo(
    () => factures.filter((f) => soldeFacture(data, f).reste > 0 || f.id === factureId),
    [factures, data, factureId],
  );

  const [fid, setFid] = useState("");
  const [montant, setMontant] = useState(0);
  const [mode, setMode] = useState<ModePaiement>("virement");
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});

  const facture = data.factures.find((f) => f.id === fid);
  const solde = facture ? soldeFacture(data, facture) : undefined;
  const client = facture ? data.clients.find((c) => c.id === facture.clientId) : undefined;

  useEffect(() => {
    if (!open) return;
    const f = factureId ? data.factures.find((x) => x.id === factureId) : undefined;
    setFid(factureId ?? "");
    setMontant(f ? soldeFacture(data, f).reste : 0);
    setMode("virement");
    setDate(toInputDate(new Date().toISOString()));
    setReference("");
    setNote("");
    setErr({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, factureId]);

  const onFacture = (id: string) => {
    setFid(id);
    const f = data.factures.find((x) => x.id === id);
    if (f) setMontant(soldeFacture(data, f).reste);
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!fid) e.facture = "Sélectionnez une facture.";
    if (!(montant > 0)) e.montant = "Le montant doit être supérieur à zéro.";
    else if (solde && montant > solde.reste + 0.01)
      e.montant = `Le montant dépasse le solde restant (${fmtMAD(solde.reste)}).`;
    if (!date) e.date = "Indiquez la date du règlement.";
    if (mode === "cheque" && !reference.trim()) e.reference = "Indiquez le numéro du chèque.";
    if (mode === "virement" && !reference.trim())
      e.reference = "Indiquez la référence du virement.";
    setErr(e);
    if (Object.keys(e).length) return;
    const r = tryAction(() =>
      addPaiement({
        factureId: fid,
        montant,
        mode,
        date: fromInputDate(date),
        reference: reference.trim(),
        note: note.trim(),
      }),
    );
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Paiement de ${fmtMAD(montant)} enregistré.`);
    onOpenChange(false);
    onSaved?.(r.value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Le solde de la facture et les statistiques d'encaissement sont mis à jour immédiatement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Facture</Label>
            {factureId ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{facture?.numero}</span> — {client?.nom}
              </div>
            ) : (
              <Select value={fid} onValueChange={onFacture}>
                <SelectTrigger className={cn("h-10 bg-card", err.facture && "border-destructive")}>
                  <SelectValue
                    placeholder={
                      ouvertes.length
                        ? "Sélectionner une facture à régler"
                        : "Aucune facture en attente de règlement"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {ouvertes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.numero} — {data.clients.find((c) => c.id === f.clientId)?.nom} — reste{" "}
                      {fmtMAD(soldeFacture(data, f).reste)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {err.facture && <p className="text-xs text-destructive">{err.facture}</p>}
          </div>

          {solde && (
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-accent/50 p-3 text-center text-xs">
              <div>
                <p className="text-muted-foreground">Total TTC</p>
                <p className="font-semibold tabular">{fmtMAD(solde.ttc)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Déjà réglé</p>
                <p className="font-semibold text-success tabular">{fmtMAD(solde.paye)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reste dû</p>
                <p className="font-semibold tabular">{fmtMAD(solde.reste)}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pay-montant">Montant (DH)</Label>
                {solde && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setMontant(solde.reste)}
                  >
                    Solde total
                  </button>
                )}
              </div>
              <Input
                id="pay-montant"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className={cn("h-10 bg-card tabular", err.montant && "border-destructive")}
                value={montant}
                onChange={(e) => setMontant(Number(e.target.value))}
              />
              {err.montant && <p className="text-xs text-destructive">{err.montant}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ModePaiement)}>
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODES_PAIEMENT) as ModePaiement[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODES_PAIEMENT[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date du règlement</Label>
              <Input
                id="pay-date"
                type="date"
                className={cn("h-10 bg-card", err.date && "border-destructive")}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {err.date && <p className="text-xs text-destructive">{err.date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">
                {mode === "cheque"
                  ? "N° de chèque"
                  : mode === "virement"
                    ? "Référence du virement"
                    : "Référence (facultatif)"}
              </Label>
              <Input
                id="pay-ref"
                className={cn("h-10 bg-card", err.reference && "border-destructive")}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={
                  mode === "cheque"
                    ? "Ex. 4587120"
                    : mode === "virement"
                      ? "Ex. VIR-2026-1185"
                      : "Ex. ticket TPE"
                }
              />
              {err.reference && <p className="text-xs text-destructive">{err.reference}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-note">Note</Label>
            <Textarea
              id="pay-note"
              rows={2}
              className="bg-card"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Banque émettrice, remarque…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!fid && !ouvertes.length}>
            Enregistrer le paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
