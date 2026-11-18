import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  Eye,
  FileSpreadsheet,
  FileText,
  Hourglass,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { DataTable, type Column } from "@/components/erp/data-table";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { matches, SearchInput } from "@/components/erp/search-input";
import { StatusBadge } from "@/components/erp/status-badge";
import { cn } from "@/lib/utils";
import { round2, totaux } from "@/lib/erp/calc";
import { DEVIS_STATUTS } from "@/lib/erp/constants";
import { exportXlsx } from "@/lib/erp/export";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact, toInputDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Devis, DevisStatut } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/devis/")({
  validateSearch: (s: Record<string, unknown>): { statut?: DevisStatut; q?: string } => ({
    statut:
      typeof s.statut === "string" && s.statut in DEVIS_STATUTS
        ? (s.statut as DevisStatut)
        : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: pageHead("Devis", "Création, suivi et transformation des devis clients en commandes."),
  component: DevisPage,
});

const ALL = "__all";
type Filtre = DevisStatut | typeof ALL;

function DevisPage() {
  const search = Route.useSearch();
  const { data, devis, isAdmin } = useScoped();
  const navigate = useNavigate();
  const duplicateDevis = useErp((s) => s.duplicateDevis);
  const deleteDevis = useErp((s) => s.deleteDevis);
  const [q, setQ] = useState(search.q ?? "");
  const [statut, setStatut] = useState<Filtre>(search.statut ?? ALL);
  const [commercial, setCommercial] = useState(ALL);
  const [toDelete, setToDelete] = useState<Devis>();

  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.nom ?? "—";
  const userName = (id: string) => data.users.find((u) => u.id === id)?.nom ?? "—";
  const commerciaux = data.users.filter((u) => u.role === "commercial");
  const now = Date.now();
  const depasse = (d: Devis) =>
    (d.statut === "envoye" || d.statut === "brouillon") && new Date(d.validite).getTime() < now;

  const base = useMemo(
    () => devis.filter((d) => commercial === ALL || d.commercialId === commercial),
    [devis, commercial],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { [ALL]: base.length };
    for (const d of base) c[d.statut] = (c[d.statut] ?? 0) + 1;
    return c;
  }, [base]);
  const rows = useMemo(
    () =>
      base.filter(
        (d) =>
          (statut === ALL || d.statut === statut) &&
          matches(q, d.numero, clientName(d.clientId), userName(d.commercialId)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, statut, q, data],
  );

  const kpi = useMemo(() => {
    const total = round2(base.reduce((s, d) => s + totaux(d).ttc, 0));
    const decides = base.filter((d) => ["accepte", "refuse", "expire"].includes(d.statut));
    const acceptes = base.filter((d) => d.statut === "accepte");
    const attente = base.filter((d) => d.statut === "envoye");
    return {
      total,
      taux: decides.length ? (acceptes.length / decides.length) * 100 : 0,
      acceptes: acceptes.length,
      attente: attente.length,
      montantAttente: round2(attente.reduce((s, d) => s + totaux(d).ttc, 0)),
      transformes: base.filter((d) => d.commandeId).length,
    };
  }, [base]);

  const dupliquer = (d: Devis) => {
    const r = tryAction(() => duplicateDevis(d.id));
    if (!r.ok) return void toast.error(r.error);
    toast.success(`Devis ${d.numero} dupliqué en brouillon.`);
    navigate({ to: "/devis/$id", params: { id: r.value } });
  };

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Devis",
          rows: rows.map((d) => {
            const t = totaux(d);
            return {
              Numéro: d.numero,
              Client: clientName(d.clientId),
              Commercial: userName(d.commercialId),
              Date: fmtDate(d.date),
              Validité: fmtDate(d.validite),
              Statut: DEVIS_STATUTS[d.statut].label,
              "Montant HT": t.ht,
              TVA: t.tva,
              "Montant TTC": t.ttc,
            };
          }),
        },
      ],
      `devis-${toInputDate(new Date().toISOString())}.xlsx`,
    ).then(() => toast.success("Export Excel généré."));

  const actions = (d: Devis) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => navigate({ to: "/devis/$id", params: { id: d.id } })}>
          <Eye /> Consulter
        </DropdownMenuItem>
        {!d.commandeId && (
          <DropdownMenuItem
            onSelect={() => navigate({ to: "/devis/$id/modifier", params: { id: d.id } })}
          >
            <Pencil /> Modifier
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => dupliquer(d)}>
          <Copy /> Dupliquer
        </DropdownMenuItem>
        {!d.commandeId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setToDelete(d)}
            >
              <Trash2 /> Supprimer
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: Column<Devis>[] = [
    {
      id: "numero",
      header: "Devis",
      sort: (d) => d.numero,
      cell: (d) => (
        <div>
          <p className="font-medium tabular">{d.numero}</p>
          {d.commandeId && <p className="text-xs text-success">Transformé en commande</p>}
        </div>
      ),
    },
    {
      id: "client",
      header: "Client",
      sort: (d) => clientName(d.clientId),
      cell: (d) => <span className="font-medium">{clientName(d.clientId)}</span>,
    },
    ...(isAdmin
      ? [
          {
            id: "com",
            header: "Commercial",
            sort: (d: Devis) => userName(d.commercialId),
            cell: (d: Devis) => userName(d.commercialId),
            hideBelow: "lg" as const,
          },
        ]
      : []),
    { id: "date", header: "Date", sort: (d) => d.date, cell: (d) => fmtDate(d.date) },
    {
      id: "validite",
      header: "Validité",
      sort: (d) => d.validite,
      hideBelow: "xl",
      cell: (d) => (
        <span className={cn(depasse(d) && "font-medium text-destructive")}>
          {fmtDate(d.validite)}
        </span>
      ),
    },
    {
      id: "ttc",
      header: "Montant TTC",
      align: "right",
      sort: (d) => totaux(d).ttc,
      cell: (d) => <span className="font-semibold">{fmtMAD(totaux(d).ttc)}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      sort: (d) => d.statut,
      cell: (d) => (
        <StatusBadge tone={DEVIS_STATUTS[d.statut].tone}>
          {DEVIS_STATUTS[d.statut].label}
        </StatusBadge>
      ),
    },
    { id: "a", header: "", align: "right", cell: actions },
  ];

  const filtres: Filtre[] = [ALL, "brouillon", "envoye", "accepte", "refuse", "expire"];

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Devis" : "Mes devis"}
        description="Préparez vos offres, suivez les réponses clients et transformez les devis acceptés en commandes."
        actions={
          <>
            <Button variant="outline" onClick={exporter}>
              <FileSpreadsheet /> Exporter
            </Button>
            <Button asChild>
              <Link to="/devis/nouveau">
                <Plus /> Nouveau devis
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="Montant total des devis"
          value={fmtMADCompact(kpi.total)}
          icon={Wallet}
          footer={<span className="text-primary-foreground/70">{fmtInt(base.length)} devis</span>}
        />
        <KpiCard
          label="Taux d'acceptation"
          value={`${fmtInt(kpi.taux)} %`}
          icon={CheckCircle2}
          footer={<span className="text-muted-foreground">{kpi.acceptes} devis acceptés</span>}
        />
        <KpiCard
          label="En attente de réponse"
          value={fmtInt(kpi.attente)}
          icon={Hourglass}
          footer={
            <span className="text-muted-foreground">
              {fmtMADCompact(kpi.montantAttente)} en jeu
            </span>
          }
        />
        <KpiCard
          label="Transformés en commande"
          value={fmtInt(kpi.transformes)}
          icon={FileText}
          footer={<span className="text-muted-foreground">sur {base.length} devis</span>}
        />
      </div>

      <div className="card-surface mb-4 space-y-3 p-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {filtres.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatut(f)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statut === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {f === ALL ? "Tous" : DEVIS_STATUTS[f].label}
              <span
                className={cn(
                  "rounded-full px-1.5 tabular",
                  statut === f ? "bg-primary-foreground/15" : "bg-card",
                )}
              >
                {counts[f] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="N° de devis, client, commercial…"
            className="sm:w-80"
          />
          {isAdmin && (
            <Select value={commercial} onValueChange={setCommercial}>
              <SelectTrigger className="h-10 bg-card sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les commerciaux</SelectItem>
                {commerciaux.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          initialSort={{ id: "date", dir: "desc" }}
          onRowClick={(d) => navigate({ to: "/devis/$id", params: { id: d.id } })}
          emptyTitle="Aucun devis trouvé"
          emptyDescription="Modifiez vos filtres ou créez un nouveau devis."
          mobileCard={(d) => (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium tabular">{d.numero}</p>
                  <StatusBadge tone={DEVIS_STATUTS[d.statut].tone}>
                    {DEVIS_STATUTS[d.statut].label}
                  </StatusBadge>
                </div>
                <p className="truncate text-sm">{clientName(d.clientId)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(d.date)} · valable jusqu'au {fmtDate(d.validite)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="font-semibold tabular">{fmtMAD(totaux(d).ttc)}</p>
                {actions(d)}
              </div>
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title="Supprimer ce devis ?"
        description={`Le devis ${toDelete?.numero ?? ""} sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          const r = tryAction(() => deleteDevis(toDelete.id));
          if (r.ok) toast.success("Devis supprimé.");
          else toast.error(r.error);
        }}
      />
    </div>
  );
}
