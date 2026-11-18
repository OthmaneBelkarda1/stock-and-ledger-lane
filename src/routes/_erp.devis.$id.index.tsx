import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  ChevronDown,
  Copy,
  Info,
  Pencil,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { BackLink, DocNotFound, DocumentActions } from "@/components/erp/document-actions";
import { DocumentView } from "@/components/erp/document-view";
import { PageHeader } from "@/components/erp/page-header";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { cartonsNecessaires, cartonsToM2, ligneNet, stockDisponible, totaux } from "@/lib/erp/calc";
import { DEVIS_STATUTS, UNITE_LABELS } from "@/lib/erp/constants";
import { fmtDate, fmtMAD, fmtQty } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import { tryAction, useErp } from "@/lib/erp/store";
import type { DevisStatut } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/devis/$id/")({
  head: pageHead("Devis", "Détail du devis, impression, PDF et transformation en commande."),
  component: Page,
});

const STATUTS: DevisStatut[] = ["brouillon", "envoye", "accepte", "refuse", "expire"];

function Page() {
  const { id } = Route.useParams();
  const { data, devis } = useScoped();
  const navigate = useNavigate();
  const setDevisStatut = useErp((s) => s.setDevisStatut);
  const duplicateDevis = useErp((s) => s.duplicateDevis);
  const convertirDevis = useErp((s) => s.convertirDevis);
  const deleteDevis = useErp((s) => s.deleteDevis);
  const ref = useRef<HTMLDivElement>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dv = devis.find((d) => d.id === id);
  if (!dv) return <DocNotFound title="Devis introuvable" back="/devis" />;

  const client = data.clients.find((c) => c.id === dv.clientId);
  const commercial = data.users.find((u) => u.id === dv.commercialId);
  const commande = dv.commandeId ? data.commandes.find((c) => c.id === dv.commandeId) : undefined;
  const t = totaux(dv);
  const st = DEVIS_STATUTS[dv.statut];
  const expire =
    !dv.commandeId &&
    (dv.statut === "envoye" || dv.statut === "brouillon") &&
    new Date(dv.validite).getTime() < Date.now();
  const convertible = !dv.commandeId && (dv.statut === "accepte" || dv.statut === "envoye");
  const manques = dv.lignes
    .map((l) => {
      const p = data.products.find((x) => x.id === l.productId);
      if (!p) return null;
      const besoin = cartonsNecessaires(p, l.unite, l.quantite);
      const dispo = stockDisponible(data, p.id);
      return besoin > dispo
        ? `${p.nom} (${besoin} cartons demandés, ${Math.max(0, dispo)} disponibles)`
        : null;
    })
    .filter(Boolean) as string[];

  const changerStatut = (s: DevisStatut) => {
    const r = tryAction(() => setDevisStatut(dv.id, s));
    if (r.ok) toast.success(`Devis marqué « ${DEVIS_STATUTS[s].label} ».`);
    else toast.error(r.error);
  };
  const dupliquer = () => {
    const r = tryAction(() => duplicateDevis(dv.id));
    if (!r.ok) return void toast.error(r.error);
    toast.success("Devis dupliqué en brouillon.");
    navigate({ to: "/devis/$id", params: { id: r.value } });
  };
  const convertir = () => {
    const r = tryAction(() => convertirDevis(dv.id));
    if (!r.ok) return void toast.error(r.error);
    toast.success("Commande créée : le stock a été réservé.");
    navigate({ to: "/commandes/$id", params: { id: r.value } });
  };

  const etape = commande
    ? {
        text: `Ce devis a été transformé en commande ${commande.numero}. Suivez sa préparation et sa livraison depuis la fiche commande.`,
        tone: "success" as const,
      }
    : dv.statut === "brouillon"
      ? {
          text: "Étape suivante : finalisez le devis puis marquez-le comme « Envoyé » une fois transmis au client (impression ou PDF).",
          tone: "info" as const,
        }
      : dv.statut === "envoye"
        ? {
            text: "En attente de la réponse du client. Marquez-le « Accepté » ou transformez-le directement en commande pour réserver le stock.",
            tone: "info" as const,
          }
        : dv.statut === "accepte"
          ? {
              text: "Le client a accepté ce devis : transformez-le en commande pour réserver les produits dans le stock.",
              tone: "success" as const,
            }
          : {
              text: "Ce devis est clôturé. Dupliquez-le pour proposer une nouvelle offre au client.",
              tone: "warning" as const,
            };

  return (
    <div>
      <BackLink to="/devis" label="Retour aux devis" />
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            Devis <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          </span>
        }
        title={dv.numero}
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
            · émis le {fmtDate(dv.date)} · valable jusqu'au{" "}
            <span className={expire ? "font-medium text-destructive" : undefined}>
              {fmtDate(dv.validite)}
            </span>
          </>
        }
        actions={
          <>
            {!dv.commandeId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Statut <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Changer le statut
                  </DropdownMenuLabel>
                  {STATUTS.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      disabled={s === dv.statut}
                      onSelect={() => changerStatut(s)}
                    >
                      <StatusBadge tone={DEVIS_STATUTS[s].tone}>
                        {DEVIS_STATUTS[s].label}
                      </StatusBadge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!dv.commandeId && (
              <Button variant="outline" asChild>
                <Link to="/devis/$id/modifier" params={{ id: dv.id }}>
                  <Pencil /> Modifier
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={dupliquer}>
              <Copy /> Dupliquer
            </Button>
            <DocumentActions targetRef={ref} filename={`${dv.numero}.pdf`} />
            {!dv.commandeId && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                aria-label="Supprimer le devis"
              >
                <Trash2 />
              </Button>
            )}
            {convertible && (
              <Button onClick={() => setConfirmConvert(true)}>
                <ArrowRightLeft /> Transformer en commande
              </Button>
            )}
            {commande && (
              <Button asChild>
                <Link to="/commandes/$id" params={{ id: commande.id }}>
                  <ShoppingCart /> Voir la commande {commande.numero}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div
        className={
          "mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm " +
          (etape.tone === "success"
            ? "border-success/30 bg-success-soft"
            : etape.tone === "warning"
              ? "border-warning/30 bg-warning-soft"
              : "border-info/30 bg-info-soft")
        }
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>{etape.text}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 min-w-0 xl:order-1">
          <DocumentView
            ref={ref}
            doc={{
              type: "DEVIS",
              numero: dv.numero,
              date: dv.date,
              client,
              commercial: commercial?.nom,
              meta: [
                { label: "Valable jusqu'au", value: fmtDate(dv.validite) },
                { label: "Statut", value: st.label },
              ],
              lignes: dv.lignes,
              tauxTVA: dv.tauxTVA,
              remiseGlobale: dv.remiseGlobale,
              notes: dv.notes,
            }}
          />
        </div>

        <div className="order-1 space-y-5 xl:order-2">
          <SectionCard title="Synthèse">
            <dl className="space-y-2 text-sm tabular">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Commercial</dt>
                <dd className="font-medium">{commercial?.nom ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Articles</dt>
                <dd>{dv.lignes.length}</dd>
              </div>
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
                <dt className="text-muted-foreground">TVA ({dv.tauxTVA} %)</dt>
                <dd>{fmtMAD(t.tva)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-primary px-3 py-2.5 text-primary-foreground">
                <dt className="font-medium">Total TTC</dt>
                <dd className="text-lg font-semibold">{fmtMAD(t.ttc)}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Produits" bodyClassName="p-0">
            <ul className="divide-y">
              {dv.lignes.map((l) => {
                const p = data.products.find((x) => x.id === l.productId);
                const ct = p ? cartonsNecessaires(p, l.unite, l.quantite) : 0;
                return (
                  <li key={l.id} className="px-4 py-3 text-sm md:px-5">
                    <div className="flex justify-between gap-3">
                      <p className="min-w-0 truncate font-medium">{l.designation}</p>
                      <p className="shrink-0 font-medium tabular">{fmtMAD(ligneNet(l))}</p>
                    </div>
                    <p className="text-xs text-muted-foreground tabular">
                      {fmtQty(l.quantite)} {UNITE_LABELS[l.unite]} × {fmtMAD(l.prixUnitaire)}
                      {l.remise ? ` · remise ${l.remise} %` : ""}
                      {p && p.m2ParCarton > 0
                        ? ` · ${ct} cartons = ${fmtQty(cartonsToM2(p, ct))} m²`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          {convertible && manques.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
              <p className="font-medium">Stock disponible insuffisant</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {manques.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                La commande pourra être créée, mais un réapprovisionnement sera nécessaire avant la
                livraison.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmConvert}
        onOpenChange={setConfirmConvert}
        title="Transformer ce devis en commande ?"
        description={`Une commande confirmée de ${fmtMAD(t.ttc)} sera créée pour ${client?.nom ?? "ce client"} et les produits seront réservés dans le stock.`}
        confirmLabel="Créer la commande"
        onConfirm={convertir}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer ce devis ?"
        description={`Le devis ${dv.numero} sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          const r = tryAction(() => deleteDevis(dv.id));
          if (!r.ok) return void toast.error(r.error);
          toast.success("Devis supprimé.");
          navigate({ to: "/devis" });
        }}
      />
    </div>
  );
}
