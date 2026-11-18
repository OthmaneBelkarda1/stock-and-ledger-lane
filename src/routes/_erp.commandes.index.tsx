import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet, PackageCheck, Plus, Receipt, ShoppingCart, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/erp/data-table";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { matches, SearchInput } from "@/components/erp/search-input";
import { StatusBadge } from "@/components/erp/status-badge";
import { cn } from "@/lib/utils";
import { estVente, round2, totaux } from "@/lib/erp/calc";
import { COMMANDE_STATUTS } from "@/lib/erp/constants";
import { exportXlsx } from "@/lib/erp/export";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact, toInputDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import type { Commande, CommandeStatut } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/commandes/")({
  validateSearch: (s: Record<string, unknown>): { statut?: CommandeStatut; q?: string } => ({
    statut:
      typeof s.statut === "string" && s.statut in COMMANDE_STATUTS
        ? (s.statut as CommandeStatut)
        : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: pageHead("Commandes", "Suivi des commandes clients, de la confirmation à la livraison."),
  component: CommandesPage,
});

const ALL = "__all";
type Filtre = CommandeStatut | typeof ALL;
const FILTRES: Filtre[] = [
  ALL,
  "en_attente",
  "confirmee",
  "en_preparation",
  "prete",
  "livree",
  "annulee",
];

function CommandesPage() {
  const search = Route.useSearch();
  const { data, commandes, isAdmin } = useScoped();
  const navigate = useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [statut, setStatut] = useState<Filtre>(search.statut ?? ALL);
  const [commercial, setCommercial] = useState(ALL);

  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.nom ?? "—";
  const userName = (id: string) => data.users.find((u) => u.id === id)?.nom ?? "—";
  const factureNum = (c: Commande) =>
    c.factureId ? data.factures.find((f) => f.id === c.factureId)?.numero : undefined;

  const base = useMemo(
    () => commandes.filter((c) => commercial === ALL || c.commercialId === commercial),
    [commandes, commercial],
  );
  const counts = useMemo(() => {
    const r: Record<string, number> = { [ALL]: base.length };
    for (const c of base) r[c.statut] = (r[c.statut] ?? 0) + 1;
    return r;
  }, [base]);
  const rows = useMemo(
    () =>
      base.filter(
        (c) =>
          (statut === ALL || c.statut === statut) &&
          matches(q, c.numero, clientName(c.clientId), userName(c.commercialId)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, statut, q, data],
  );

  const kpi = useMemo(() => {
    const ventes = base.filter(estVente);
    const enCours = base.filter((c) => ["confirmee", "en_preparation", "prete"].includes(c.statut));
    const aFacturer = ventes.filter((c) => !c.factureId);
    return {
      ca: round2(ventes.reduce((s, c) => s + totaux(c).ttc, 0)),
      nbVentes: ventes.length,
      enCours: enCours.length,
      montantEnCours: round2(enCours.reduce((s, c) => s + totaux(c).ttc, 0)),
      aLivrer: base.filter((c) => c.statut === "prete").length,
      attente: base.filter((c) => c.statut === "en_attente").length,
      aFacturer: aFacturer.length,
      montantAFacturer: round2(aFacturer.reduce((s, c) => s + totaux(c).ttc, 0)),
    };
  }, [base]);

  const retard = (c: Commande) =>
    ["confirmee", "en_preparation", "prete"].includes(c.statut) &&
    new Date(c.dateLivraison).getTime() < Date.now();

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Commandes",
          rows: rows.map((c) => {
            const t = totaux(c);
            return {
              Numéro: c.numero,
              Client: clientName(c.clientId),
              Commercial: userName(c.commercialId),
              Date: fmtDate(c.date),
              "Livraison prévue": fmtDate(c.dateLivraison),
              Statut: COMMANDE_STATUTS[c.statut].label,
              Facture: factureNum(c) ?? "",
              "Montant HT": t.ht,
              TVA: t.tva,
              "Montant TTC": t.ttc,
            };
          }),
        },
      ],
      `commandes-${toInputDate(new Date().toISOString())}.xlsx`,
    ).then(() => toast.success("Export Excel généré."));

  const facturation = (c: Commande) =>
    c.factureId ? (
      <StatusBadge tone="success" withDot={false}>
        <Receipt className="size-3" /> {factureNum(c)}
      </StatusBadge>
    ) : estVente(c) ? (
      <StatusBadge tone="warning">À facturer</StatusBadge>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );

  const columns: Column<Commande>[] = [
    {
      id: "numero",
      header: "Commande",
      sort: (c) => c.numero,
      cell: (c) => <span className="font-medium tabular">{c.numero}</span>,
    },
    {
      id: "client",
      header: "Client",
      sort: (c) => clientName(c.clientId),
      cell: (c) => <span className="font-medium">{clientName(c.clientId)}</span>,
    },
    ...(isAdmin
      ? [
          {
            id: "com",
            header: "Commercial",
            sort: (c: Commande) => userName(c.commercialId),
            cell: (c: Commande) => userName(c.commercialId),
            hideBelow: "xl" as const,
          },
        ]
      : []),
    { id: "date", header: "Date", sort: (c) => c.date, cell: (c) => fmtDate(c.date) },
    {
      id: "liv",
      header: "Livraison",
      sort: (c) => c.dateLivraison,
      hideBelow: "lg",
      cell: (c) => (
        <span className={cn(retard(c) && "font-medium text-destructive")}>
          {c.statut === "livree"
            ? `Livrée le ${fmtDate(c.dateLivraison)}`
            : fmtDate(c.dateLivraison)}
        </span>
      ),
    },
    {
      id: "ttc",
      header: "Montant TTC",
      align: "right",
      sort: (c) => totaux(c).ttc,
      cell: (c) => <span className="font-semibold">{fmtMAD(totaux(c).ttc)}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      sort: (c) => c.statut,
      cell: (c) => (
        <StatusBadge tone={COMMANDE_STATUTS[c.statut].tone}>
          {COMMANDE_STATUTS[c.statut].label}
        </StatusBadge>
      ),
    },
    { id: "fac", header: "Facturation", hideBelow: "lg", cell: facturation },
  ];

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Commandes" : "Mes commandes"}
        description="Suivez chaque commande de la confirmation à la livraison : le stock est réservé puis déduit automatiquement."
        actions={
          <>
            <Button variant="outline" onClick={exporter}>
              <FileSpreadsheet /> Exporter
            </Button>
            <Button asChild>
              <Link to="/commandes/nouvelle">
                <Plus /> Nouvelle commande
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="Montant des ventes"
          value={fmtMADCompact(kpi.ca)}
          icon={ShoppingCart}
          footer={
            <span className="text-primary-foreground/70">
              {fmtInt(kpi.nbVentes)} commandes validées
            </span>
          }
        />
        <KpiCard
          label="En cours"
          value={fmtInt(kpi.enCours)}
          icon={PackageCheck}
          footer={
            <span className="text-muted-foreground">
              {fmtMADCompact(kpi.montantEnCours)} · {kpi.attente} en attente
            </span>
          }
        />
        <KpiCard
          label="Prêtes à livrer"
          value={fmtInt(kpi.aLivrer)}
          icon={Truck}
          footer={<span className="text-muted-foreground">à expédier</span>}
        />
        <KpiCard
          label="À facturer"
          value={fmtInt(kpi.aFacturer)}
          icon={Receipt}
          footer={
            <span className="text-muted-foreground">{fmtMADCompact(kpi.montantAFacturer)}</span>
          }
        />
      </div>

      <div className="card-surface mb-4 space-y-3 p-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {FILTRES.map((f) => (
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
              {f === ALL ? "Toutes" : COMMANDE_STATUTS[f].label}
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
            placeholder="N° de commande, client, commercial…"
            className="sm:w-80"
          />
          {isAdmin && (
            <Select value={commercial} onValueChange={setCommercial}>
              <SelectTrigger className="h-10 bg-card sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les commerciaux</SelectItem>
                {data.users
                  .filter((u) => u.role === "commercial")
                  .map((u) => (
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
          rowKey={(c) => c.id}
          initialSort={{ id: "date", dir: "desc" }}
          onRowClick={(c) => navigate({ to: "/commandes/$id", params: { id: c.id } })}
          emptyTitle="Aucune commande trouvée"
          emptyDescription="Modifiez vos filtres ou créez une nouvelle commande."
          mobileCard={(c) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium tabular">{c.numero}</p>
                  <StatusBadge tone={COMMANDE_STATUTS[c.statut].tone}>
                    {COMMANDE_STATUTS[c.statut].label}
                  </StatusBadge>
                </div>
                <p className="truncate text-sm">{clientName(c.clientId)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(c.date)} · livraison {fmtDate(c.dateLivraison)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="font-semibold tabular">{fmtMAD(totaux(c).ttc)}</p>
                {facturation(c)}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
