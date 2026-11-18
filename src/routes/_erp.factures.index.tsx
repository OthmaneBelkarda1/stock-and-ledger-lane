import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlarmClock,
  CircleDollarSign,
  FileSpreadsheet,
  HandCoins,
  Plus,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/erp/data-table";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { matches, SearchInput } from "@/components/erp/search-input";
import { StatusBadge } from "@/components/erp/status-badge";
import { cn } from "@/lib/utils";
import { round2, soldeFacture, statutFacture } from "@/lib/erp/calc";
import { FACTURE_STATUTS, type FactureStatut } from "@/lib/erp/constants";
import { exportXlsx } from "@/lib/erp/export";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact, toInputDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import { can } from "@/lib/erp/permissions";

type Filtre = "toutes" | "impayees" | "retard" | FactureStatut;

export const Route = createFileRoute("/_erp/factures/")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { statut?: "impayees" | FactureStatut; q?: string } => ({
    statut:
      s.statut === "impayees" || (typeof s.statut === "string" && s.statut in FACTURE_STATUTS)
        ? (s.statut as "impayees" | FactureStatut)
        : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: pageHead("Factures", "Factures clients, échéances, règlements et soldes restants."),
  component: FacturesPage,
});

const FILTRES: { id: Filtre; label: string }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "impayees", label: "À encaisser" },
  { id: "retard", label: "En retard" },
  { id: "impayee", label: "Impayées" },
  { id: "partielle", label: "Partiellement payées" },
  { id: "payee", label: "Payées" },
];

const garde = (i: { statut: FactureStatut; retard: boolean }, f: Filtre) =>
  f === "toutes"
    ? true
    : f === "impayees"
      ? i.statut !== "payee"
      : f === "retard"
        ? i.retard
        : i.statut === f;

function FacturesPage() {
  const search = Route.useSearch();
  const { data, factures, isAdmin, user } = useScoped();
  const navigate = useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [filtre, setFiltre] = useState<Filtre>(search.statut ?? "toutes");
  const [payOpen, setPayOpen] = useState(false);
  const canPay = can(user, "enregistrer_paiement");

  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.nom ?? "—";
  const userName = (id: string) => data.users.find((u) => u.id === id)?.nom ?? "—";
  const now = Date.now();

  const infos = useMemo(
    () =>
      factures.map((f) => {
        const s = soldeFacture(data, f);
        const statut = statutFacture(data, f);
        return {
          f,
          ...s,
          statut,
          retard: statut !== "payee" && new Date(f.echeance).getTime() < now,
        };
      }),
    [factures, data, now],
  );
  type Info = (typeof infos)[number];

  const counts = useMemo(
    () =>
      Object.fromEntries(FILTRES.map((x) => [x.id, infos.filter((i) => garde(i, x.id)).length])),
    [infos],
  );
  const rows = useMemo(
    () =>
      infos.filter(
        (i) =>
          garde(i, filtre) &&
          matches(q, i.f.numero, clientName(i.f.clientId), userName(i.f.commercialId)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [infos, filtre, q],
  );

  const kpi = useMemo(() => {
    const total = round2(infos.reduce((s, i) => s + i.ttc, 0));
    const paye = round2(infos.reduce((s, i) => s + i.paye, 0));
    const reste = round2(infos.reduce((s, i) => s + i.reste, 0));
    const retard = infos.filter((i) => i.retard);
    return {
      total,
      paye,
      reste,
      taux: total ? (paye / total) * 100 : 0,
      nbRetard: retard.length,
      montantRetard: round2(retard.reduce((s, i) => s + i.reste, 0)),
    };
  }, [infos]);

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Factures",
          rows: rows.map((i) => ({
            Numéro: i.f.numero,
            Client: clientName(i.f.clientId),
            Commercial: userName(i.f.commercialId),
            Date: fmtDate(i.f.date),
            Échéance: fmtDate(i.f.echeance),
            Statut: FACTURE_STATUTS[i.statut].label + (i.retard ? " (en retard)" : ""),
            "Montant TTC": i.ttc,
            Payé: i.paye,
            "Reste à payer": i.reste,
          })),
        },
      ],
      `factures-${toInputDate(new Date().toISOString())}.xlsx`,
    ).then(() => toast.success("Export Excel généré."));

  const statutCell = (i: Info) => (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge tone={FACTURE_STATUTS[i.statut].tone}>
        {FACTURE_STATUTS[i.statut].label}
      </StatusBadge>
      {i.retard && (
        <StatusBadge tone="danger" withDot={false}>
          <AlarmClock className="size-3" /> En retard
        </StatusBadge>
      )}
    </div>
  );

  const columns: Column<Info>[] = [
    {
      id: "numero",
      header: "Facture",
      sort: (i) => i.f.numero,
      cell: (i) => <span className="font-medium tabular">{i.f.numero}</span>,
    },
    {
      id: "client",
      header: "Client",
      sort: (i) => clientName(i.f.clientId),
      cell: (i) => <span className="font-medium">{clientName(i.f.clientId)}</span>,
    },
    ...(isAdmin
      ? [
          {
            id: "com",
            header: "Commercial",
            sort: (i: Info) => userName(i.f.commercialId),
            cell: (i: Info) => userName(i.f.commercialId),
            hideBelow: "xl" as const,
          },
        ]
      : []),
    {
      id: "date",
      header: "Date",
      sort: (i) => i.f.date,
      cell: (i) => fmtDate(i.f.date),
      hideBelow: "lg",
    },
    {
      id: "ech",
      header: "Échéance",
      sort: (i) => i.f.echeance,
      cell: (i) => (
        <span className={cn(i.retard && "font-medium text-destructive")}>
          {fmtDate(i.f.echeance)}
        </span>
      ),
    },
    {
      id: "ttc",
      header: "Montant TTC",
      align: "right",
      sort: (i) => i.ttc,
      cell: (i) => fmtMAD(i.ttc),
    },
    {
      id: "reste",
      header: "Reste à payer",
      align: "right",
      sort: (i) => i.reste,
      cell: (i) => (
        <div className="ml-auto w-28">
          <p className={cn("font-semibold", i.reste > 0 ? "text-foreground" : "text-success")}>
            {fmtMAD(i.reste)}
          </p>
          <Progress value={i.ttc ? (i.paye / i.ttc) * 100 : 0} className="mt-1 h-1" />
        </div>
      ),
    },
    { id: "statut", header: "Statut", sort: (i) => i.statut, cell: statutCell },
  ];

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Factures" : "Mes factures"}
        description="Suivez les échéances, les règlements reçus et les soldes restant à encaisser."
        actions={
          <>
            <Button variant="outline" onClick={exporter}>
              <FileSpreadsheet /> Exporter
            </Button>
            {canPay && (
              <Button onClick={() => setPayOpen(true)}>
                <Plus /> Enregistrer un paiement
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="Total facturé"
          value={fmtMADCompact(kpi.total)}
          icon={Receipt}
          footer={
            <span className="text-primary-foreground/70">{fmtInt(infos.length)} factures</span>
          }
        />
        <KpiCard
          label="Encaissé"
          value={fmtMADCompact(kpi.paye)}
          icon={HandCoins}
          footer={<span className="text-muted-foreground">{fmtInt(kpi.taux)} % du facturé</span>}
        />
        <KpiCard
          label="Reste à encaisser"
          value={fmtMADCompact(kpi.reste)}
          icon={CircleDollarSign}
          footer={
            <span className="text-muted-foreground">{counts.impayees} factures ouvertes</span>
          }
        />
        <KpiCard
          label="En retard"
          value={fmtInt(kpi.nbRetard)}
          icon={AlarmClock}
          footer={
            <span className="text-destructive">{fmtMADCompact(kpi.montantRetard)} échus</span>
          }
        />
      </div>

      <div className="card-surface mb-4 space-y-3 p-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {FILTRES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setFiltre(x.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filtre === x.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
              <span
                className={cn(
                  "rounded-full px-1.5 tabular",
                  filtre === x.id ? "bg-primary-foreground/15" : "bg-card",
                )}
              >
                {counts[x.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="N° de facture, client, commercial…"
          className="sm:w-80"
        />
      </div>

      <div className="card-surface overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(i) => i.f.id}
          initialSort={{ id: "date", dir: "desc" }}
          onRowClick={(i) => navigate({ to: "/factures/$id", params: { id: i.f.id } })}
          emptyTitle="Aucune facture trouvée"
          emptyDescription="Les factures sont générées depuis les commandes confirmées."
          mobileCard={(i) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium tabular">{i.f.numero}</p>
                <p className="truncate text-sm">{clientName(i.f.clientId)}</p>
                <p
                  className={cn("text-xs", i.retard ? "text-destructive" : "text-muted-foreground")}
                >
                  Échéance {fmtDate(i.f.echeance)}
                </p>
                <div className="mt-1">{statutCell(i)}</div>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular">{fmtMAD(i.ttc)}</p>
                {i.reste > 0 && (
                  <p className="text-xs text-muted-foreground tabular">reste {fmtMAD(i.reste)}</p>
                )}
              </div>
            </div>
          )}
        />
      </div>

      {canPay && <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />}
    </div>
  );
}
