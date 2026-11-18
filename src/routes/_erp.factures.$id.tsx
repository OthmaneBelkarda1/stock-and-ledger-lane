import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlarmClock, HandCoins, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { BackLink, DocNotFound, DocumentActions } from "@/components/erp/document-actions";
import { DocumentView } from "@/components/erp/document-view";
import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/erp/page-header";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { soldeFacture, statutFacture, totaux } from "@/lib/erp/calc";
import { FACTURE_STATUTS, MODES_PAIEMENT } from "@/lib/erp/constants";
import { fmtDate, fmtInt, fmtMAD } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import { can } from "@/lib/erp/permissions";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Paiement } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/factures/$id")({
  head: pageHead("Facture", "Détail de la facture, règlements et solde restant."),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { data, factures, user } = useScoped();
  const deletePaiement = useErp((s) => s.deletePaiement);
  const ref = useRef<HTMLDivElement>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Paiement>();

  const f = factures.find((x) => x.id === id);
  if (!f) return <DocNotFound title="Facture introuvable" back="/factures" />;

  const client = data.clients.find((c) => c.id === f.clientId);
  const commercial = data.users.find((u) => u.id === f.commercialId);
  const commande = data.commandes.find((c) => c.id === f.commandeId);
  const { ttc, paye, reste } = soldeFacture(data, f);
  const statut = statutFacture(data, f);
  const t = totaux(f);
  const retard = statut !== "payee" && new Date(f.echeance).getTime() < Date.now();
  const jours = Math.round((new Date(f.echeance).getTime() - Date.now()) / 86400000);
  const paiements = data.paiements
    .filter((p) => p.factureId === f.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const canPay = can(user, "enregistrer_paiement");
  const pct = ttc ? (paye / ttc) * 100 : 0;

  return (
    <div>
      <BackLink to="/factures" label="Retour aux factures" />
      <PageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            Facture{" "}
            <StatusBadge tone={FACTURE_STATUTS[statut].tone}>
              {FACTURE_STATUTS[statut].label}
            </StatusBadge>
            {retard && (
              <StatusBadge tone="danger" withDot={false}>
                <AlarmClock className="size-3" /> En retard
              </StatusBadge>
            )}
          </span>
        }
        title={f.numero}
        description={
          <>
            {client ? (
              <Link
                to="/clients/$id"
                params={{ id: client.id }}
                className="font-medium text-foreground hover:underline"
              >
                {client.nom}
              </Link>
            ) : (
              "Client supprimé"
            )}{" "}
            · émise le {fmtDate(f.date)} · échéance le {fmtDate(f.echeance)}
          </>
        }
        actions={
          <>
            {commande && (
              <Button variant="outline" asChild>
                <Link to="/commandes/$id" params={{ id: commande.id }}>
                  <ShoppingCart /> Commande {commande.numero}
                </Link>
              </Button>
            )}
            <DocumentActions targetRef={ref} filename={`${f.numero}.pdf`} />
            {canPay && reste > 0 && (
              <Button onClick={() => setPayOpen(true)}>
                <HandCoins /> Enregistrer un paiement
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 xl:order-1">
          <DocumentView
            ref={ref}
            doc={{
              type: "FACTURE",
              numero: f.numero,
              date: f.date,
              client,
              commercial: commercial?.nom,
              meta: [
                { label: "Échéance", value: fmtDate(f.echeance) },
                { label: "Commande", value: commande?.numero ?? "—" },
              ],
              lignes: f.lignes,
              tauxTVA: f.tauxTVA,
              remiseGlobale: f.remiseGlobale,
              notes: f.notes,
              paiement: { paye, reste },
            }}
          />
        </div>

        <div className="order-1 space-y-5 xl:order-2">
          <SectionCard title="Règlement">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Reste à payer</p>
                <p
                  className={
                    reste > 0
                      ? "text-2xl font-semibold tabular"
                      : "text-2xl font-semibold text-success tabular"
                  }
                >
                  {fmtMAD(reste)}
                </p>
              </div>
              <p className="text-sm font-medium tabular">{fmtInt(pct)} %</p>
            </div>
            <Progress value={pct} className="mt-3 h-2" />
            <dl className="mt-4 space-y-2 text-sm tabular">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total HT</dt>
                <dd>{fmtMAD(t.ht)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">TVA ({f.tauxTVA} %)</dt>
                <dd>{fmtMAD(t.tva)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total TTC</dt>
                <dd className="font-medium">{fmtMAD(ttc)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Déjà réglé</dt>
                <dd className="text-success">{fmtMAD(paye)}</dd>
              </div>
            </dl>
            {statut !== "payee" && (
              <p
                className={
                  retard
                    ? "mt-4 rounded-md bg-destructive-soft px-3 py-2 text-xs text-destructive"
                    : "mt-4 rounded-md bg-accent/60 px-3 py-2 text-xs text-muted-foreground"
                }
              >
                {retard
                  ? `Échéance dépassée depuis ${Math.abs(jours)} jour(s) : pensez à relancer le client.`
                  : jours === 0
                    ? "L'échéance est aujourd'hui."
                    : `Échéance dans ${jours} jour(s).`}
              </p>
            )}
            {!canPay && statut !== "payee" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Les règlements sont enregistrés par l'administration.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Historique des paiements"
            description={`${paiements.length} règlement(s)`}
            bodyClassName="p-0"
          >
            {paiements.length ? (
              <ul className="divide-y">
                {paiements.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <HandCoins className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium tabular">{fmtMAD(p.montant)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fmtDate(p.date)} · {MODES_PAIEMENT[p.mode]}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </p>
                    </div>
                    {canPay && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setToDelete(p)}
                        aria-label="Annuler ce paiement"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={HandCoins}
                title="Aucun règlement"
                description="Aucun paiement n'a encore été enregistré pour cette facture."
              />
            )}
          </SectionCard>
        </div>
      </div>

      {canPay && <PaymentDialog open={payOpen} onOpenChange={setPayOpen} factureId={f.id} />}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title="Annuler ce paiement ?"
        description={`Le règlement ${toDelete?.numero ?? ""} de ${fmtMAD(toDelete?.montant ?? 0)} sera supprimé et le solde de la facture recalculé.`}
        confirmLabel="Annuler le paiement"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          const r = tryAction(() => deletePaiement(toDelete.id));
          if (r.ok) toast.success("Paiement annulé.");
          else toast.error(r.error);
        }}
      />
    </div>
  );
}
