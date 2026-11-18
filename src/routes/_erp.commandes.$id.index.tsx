import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Ban,
  Check,
  FileText,
  MapPin,
  Pencil,
  Receipt,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { BackLink, DocNotFound, DocumentActions } from "@/components/erp/document-actions";
import { DocumentView } from "@/components/erp/document-view";
import { PageHeader } from "@/components/erp/page-header";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { cn } from "@/lib/utils";
import {
  cartonsCommande,
  cartonsToM2,
  cartonsToPieces,
  STATUTS_RESERVANTS,
  statutFacture,
  stockDisponible,
  stockPhysique,
  totaux,
} from "@/lib/erp/calc";
import { COMMANDE_FLOW, COMMANDE_STATUTS, FACTURE_STATUTS } from "@/lib/erp/constants";
import { fmtDate, fmtDateTime, fmtMAD, fmtQty } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import { can } from "@/lib/erp/permissions";
import { tryAction, useErp } from "@/lib/erp/store";
import type { CommandeStatut } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/commandes/$id/")({
  head: pageHead(
    "Commande",
    "Suivi de la commande, réservation du stock, livraison et facturation.",
  ),
  component: Page,
});

const NEXT_LABEL: Partial<Record<CommandeStatut, string>> = {
  confirmee: "Confirmer la commande",
  en_preparation: "Lancer la préparation",
  prete: "Marquer prête à livrer",
  livree: "Marquer comme livrée",
};

function Page() {
  const { id } = Route.useParams();
  const { data, commandes, user } = useScoped();
  const navigate = useNavigate();
  const setCommandeStatut = useErp((s) => s.setCommandeStatut);
  const genererFacture = useErp((s) => s.genererFacture);
  const ref = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState<CommandeStatut | "facture">();

  const c = commandes.find((x) => x.id === id);
  if (!c) return <DocNotFound title="Commande introuvable" back="/commandes" />;

  const client = data.clients.find((x) => x.id === c.clientId);
  const commercial = data.users.find((u) => u.id === c.commercialId);
  const depot = data.depots.find((d) => d.id === c.depotId);
  const devis = c.devisId ? data.devis.find((d) => d.id === c.devisId) : undefined;
  const facture = c.factureId ? data.factures.find((f) => f.id === c.factureId) : undefined;
  const t = totaux(c);
  const st = COMMANDE_STATUTS[c.statut];

  const gereStatut = can(user, "changer_statut_commande");
  const idx = COMMANDE_FLOW.indexOf(c.statut);
  const next =
    c.statut !== "annulee" && idx >= 0 && idx < COMMANDE_FLOW.length - 1
      ? COMMANDE_FLOW[idx + 1]
      : undefined;
  const peutAvancer = !!next && (gereStatut || (c.statut === "en_attente" && next === "confirmee"));
  const peutAnnuler =
    c.statut !== "livree" &&
    c.statut !== "annulee" &&
    !c.factureId &&
    (gereStatut || c.statut === "en_attente" || c.statut === "confirmee");
  const peutFacturer =
    !c.factureId &&
    can(user, "gerer_factures") &&
    c.statut !== "en_attente" &&
    c.statut !== "annulee";
  const modifiable = c.statut !== "livree" && c.statut !== "annulee" && !c.factureId;

  const reserve = STATUTS_RESERVANTS.includes(c.statut) && !c.stockDeduit;
  const ct = cartonsCommande(data, c);
  const lignesStock = Object.entries(ct).map(([pid, q]) => {
    const p = data.products.find((x) => x.id === pid);
    return {
      p,
      q,
      dispo: p ? stockDisponible(data, pid) : 0,
      physDepot: p ? stockPhysique(data, pid, c.depotId) : 0,
    };
  });
  const etatStock = c.stockDeduit
    ? { label: "Déduit du stock", tone: "success" as const }
    : reserve
      ? { label: "Réservé", tone: "info" as const }
      : c.statut === "annulee"
        ? { label: "Réservation libérée", tone: "neutral" as const }
        : { label: "Non réservé", tone: "warning" as const };

  const changer = (s: CommandeStatut) => {
    const r = tryAction(() => setCommandeStatut(c.id, s));
    if (!r.ok) return void toast.error(r.error);
    const msg: Partial<Record<CommandeStatut, string>> = {
      confirmee: "Commande confirmée : les produits sont réservés dans le stock.",
      en_preparation: "Préparation lancée.",
      prete: "Commande prête à être livrée.",
      livree: "Commande livrée : le stock a été déduit.",
      annulee: "Commande annulée : la réservation de stock a été libérée.",
    };
    toast.success(msg[s] ?? "Statut mis à jour.");
  };
  const facturer = () => {
    const r = tryAction(() => genererFacture(c.id));
    if (!r.ok) return void toast.error(r.error);
    toast.success("Facture générée.");
    navigate({ to: "/factures/$id", params: { id: r.value } });
  };

  const prochaine =
    c.statut === "annulee"
      ? "Cette commande est annulée."
      : c.statut === "livree"
        ? facture
          ? "Commande livrée et facturée. Le suivi des règlements se fait depuis la facture."
          : "Commande livrée. Étape suivante : générer la facture."
        : next
          ? `Étape suivante : ${NEXT_LABEL[next]?.toLowerCase()}.`
          : "";

  return (
    <div>
      <BackLink to="/commandes" label="Retour aux commandes" />
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            Commande <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          </span>
        }
        title={c.numero}
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
            · passée le {fmtDate(c.date)} · {fmtMAD(t.ttc)} TTC
          </>
        }
        actions={
          <>
            {modifiable && (
              <Button variant="outline" asChild>
                <Link to="/commandes/$id/modifier" params={{ id: c.id }}>
                  <Pencil /> Modifier
                </Link>
              </Button>
            )}
            <DocumentActions targetRef={ref} filename={`${c.numero}.pdf`} />
            {peutAnnuler && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirm("annulee")}
              >
                <Ban /> Annuler
              </Button>
            )}
            {peutFacturer && (
              <Button
                variant={peutAvancer ? "outline" : "default"}
                onClick={() => setConfirm("facture")}
              >
                <Receipt /> Générer la facture
              </Button>
            )}
            {facture && (
              <Button variant="outline" asChild>
                <Link to="/factures/$id" params={{ id: facture.id }}>
                  <Receipt /> Facture {facture.numero}
                </Link>
              </Button>
            )}
            {peutAvancer && next && (
              <Button onClick={() => (next === "livree" ? setConfirm("livree") : changer(next))}>
                {NEXT_LABEL[next]} <ArrowRight />
              </Button>
            )}
          </>
        }
      />

      {/* Suivi visuel des étapes */}
      <div className="card-surface mb-5 p-4 md:p-5">
        {c.statut === "annulee" ? (
          <div className="flex items-center gap-3 text-destructive">
            <XCircle className="size-5" />
            <p className="text-sm font-medium">
              Commande annulée — les produits réservés ont été remis à disposition.
            </p>
          </div>
        ) : (
          <ol className="grid grid-cols-5 gap-1">
            {COMMANDE_FLOW.map((s, i) => {
              const done = i < idx || c.statut === "livree";
              const current = i === idx && c.statut !== "livree";
              return (
                <li key={s} className="flex flex-col items-center text-center">
                  <div className="flex w-full items-center">
                    <span
                      className={cn(
                        "h-0.5 flex-1",
                        i === 0 ? "invisible" : i <= idx ? "bg-primary" : "bg-border",
                      )}
                    />
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : current
                            ? "border-primary bg-card text-primary"
                            : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "h-0.5 flex-1",
                        i === COMMANDE_FLOW.length - 1
                          ? "invisible"
                          : i < idx
                            ? "bg-primary"
                            : "bg-border",
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-[11px] leading-tight sm:text-xs",
                      current || done ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {COMMANDE_STATUTS[s].label}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        {prochaine && (
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{prochaine}</p>
        )}
        {!gereStatut &&
          c.statut !== "en_attente" &&
          c.statut !== "livree" &&
          c.statut !== "annulee" && (
            <p className="mt-1 text-xs text-muted-foreground">
              La préparation et la livraison sont pilotées par l'administration.
            </p>
          )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 space-y-5 xl:order-1">
          <SectionCard
            title="Stock"
            description="Cartons nécessaires par produit et état de la réservation"
            action={<StatusBadge tone={etatStock.tone}>{etatStock.label}</StatusBadge>}
            bodyClassName="p-0"
          >
            <ul className="divide-y">
              {lignesStock.map(({ p, q, dispo, physDepot }) => (
                <li key={p?.id ?? q} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  {p && (
                    <img
                      src={productImage(p.image)}
                      alt=""
                      className="size-10 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p?.nom ?? "Produit supprimé"} {p?.dimension}
                    </p>
                    <p className="text-xs text-muted-foreground tabular">
                      {q} cartons
                      {p && p.m2ParCarton > 0 ? ` = ${fmtQty(cartonsToM2(p, q))} m²` : ""}
                      {p ? ` · ${fmtQty(cartonsToPieces(p, q))} pièces` : ""}
                    </p>
                  </div>
                  {!c.stockDeduit && c.statut !== "annulee" && p && (
                    <div className="text-right text-xs tabular">
                      <p
                        className={cn(
                          dispo < 0 ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {dispo} ct disponibles
                      </p>
                      <p className="text-muted-foreground">{physDepot} ct au dépôt</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>

          <DocumentView
            ref={ref}
            doc={{
              type: "BON DE COMMANDE",
              numero: c.numero,
              date: c.date,
              client,
              commercial: commercial?.nom,
              meta: [
                { label: "Livraison prévue", value: fmtDate(c.dateLivraison) },
                { label: "Dépôt", value: depot?.nom ?? "—" },
                ...(devis ? [{ label: "Devis d'origine", value: devis.numero }] : []),
              ],
              lignes: c.lignes,
              tauxTVA: c.tauxTVA,
              remiseGlobale: c.remiseGlobale,
              notes: c.notes,
            }}
          />
        </div>

        <div className="order-1 space-y-5 xl:order-2">
          <SectionCard title="Montants">
            <dl className="space-y-2 text-sm tabular">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sous-total</dt>
                <dd>{fmtMAD(t.sousTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Remises</dt>
                <dd>− {fmtMAD(t.remise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total HT</dt>
                <dd className="font-medium">{fmtMAD(t.ht)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">TVA ({c.tauxTVA} %)</dt>
                <dd>{fmtMAD(t.tva)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-primary px-3 py-2.5 text-primary-foreground">
                <dt className="font-medium">Total TTC</dt>
                <dd className="text-lg font-semibold">{fmtMAD(t.ttc)}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Livraison">
            <dl className="space-y-3 text-sm">
              <div className="flex gap-3">
                <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {c.statut === "livree" ? "Livrée le" : "Livraison prévue"}
                  </dt>
                  <dd className="font-medium">
                    {c.statut === "livree"
                      ? fmtDateTime(c.dateLivraison)
                      : fmtDate(c.dateLivraison)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Adresse du client</dt>
                  <dd className="font-medium">
                    {client ? `${client.adresse}, ${client.ville}` : "—"}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Dépôt de préparation</dt>
                  <dd className="font-medium">{depot ? `${depot.nom} — ${depot.ville}` : "—"}</dd>
                </div>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Documents liés">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <FileText className="size-4" /> Devis
                </span>
                {devis ? (
                  <Link
                    to="/devis/$id"
                    params={{ id: devis.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {devis.numero}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Commande directe</span>
                )}
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Receipt className="size-4" /> Facture
                </span>
                {facture ? (
                  <Link
                    to="/factures/$id"
                    params={{ id: facture.id }}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    {facture.numero}
                    <StatusBadge tone={FACTURE_STATUTS[statutFacture(data, facture)].tone}>
                      {FACTURE_STATUTS[statutFacture(data, facture)].label}
                    </StatusBadge>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {peutFacturer ? "À générer" : c.statut === "annulee" ? "—" : "Non facturée"}
                  </span>
                )}
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Commercial</span>
                <span className="font-medium">{commercial?.nom ?? "—"}</span>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "annulee"}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        title="Annuler cette commande ?"
        description="La commande sera annulée et les produits réservés seront remis à disposition dans le stock. Cette action est irréversible."
        confirmLabel="Annuler la commande"
        destructive
        onConfirm={() => changer("annulee")}
      />
      <ConfirmDialog
        open={confirm === "livree"}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        title="Confirmer la livraison ?"
        description="Les cartons seront déduits définitivement du stock physique (lots les plus anciens en priorité)."
        confirmLabel="Confirmer la livraison"
        onConfirm={() => changer("livree")}
      />
      <ConfirmDialog
        open={confirm === "facture"}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        title="Générer la facture ?"
        description={`Une facture de ${fmtMAD(t.ttc)} TTC sera émise pour ${client?.nom ?? "ce client"}, avec une échéance à 30 jours.`}
        confirmLabel="Générer la facture"
        onConfirm={facturer}
      />
    </div>
  );
}
