import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleDollarSign, FileSpreadsheet, HandCoins, Plus, Receipt, Wallet } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartTooltip, CHART_COLORS } from "@/components/erp/chart-tooltip";
import { DataTable, type Column } from "@/components/erp/data-table";
import { EmptyState } from "@/components/erp/empty-state";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { PERIODE_LABELS, PeriodFilter, type PeriodValue } from "@/components/erp/period-filter";
import { matches, SearchInput } from "@/components/erp/search-input";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import {
  dansPlage,
  evolution,
  plagePeriode,
  plagePrecedente,
  round2,
  soldeFacture,
} from "@/lib/erp/calc";
import { MODES_PAIEMENT } from "@/lib/erp/constants";
import { exportXlsx } from "@/lib/erp/export";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact, toInputDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import type { ModePaiement, Paiement } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/paiements/")({
  head: pageHead(
    "Paiements",
    "Historique des règlements clients et répartition par mode de paiement.",
  ),
  component: PaiementsPage,
});

const ALL = "__all";
const MODE_TONE = {
  especes: "sand",
  virement: "info",
  cheque: "primary",
  carte: "success",
} as const;

function PaiementsPage() {
  const { data, paiements, factures } = useScoped();
  const [period, setPeriod] = useState<PeriodValue>({ periode: "annee" });
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const facture = (id: string) => data.factures.find((f) => f.id === id);
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.nom ?? "—";

  const m = useMemo(() => {
    const plage = plagePeriode(period.periode, period);
    const prev = plagePrecedente(plage);
    const cur = paiements.filter((p) => dansPlage(p.date, plage));
    const old = paiements.filter((p) => dansPlage(p.date, prev));
    const total = round2(cur.reduce((s, p) => s + p.montant, 0));
    const totalPrev = round2(old.reduce((s, p) => s + p.montant, 0));
    const parMode = (Object.keys(MODES_PAIEMENT) as ModePaiement[])
      .map((k) => ({
        mode: k,
        name: MODES_PAIEMENT[k],
        value: round2(cur.filter((p) => p.mode === k).reduce((s, p) => s + p.montant, 0)),
        nb: cur.filter((p) => p.mode === k).length,
      }))
      .filter((x) => x.value > 0);
    const reste = round2(factures.reduce((s, f) => s + soldeFacture(data, f).reste, 0));
    return {
      cur,
      total,
      totalPrev,
      parMode,
      reste,
      moyenne: cur.length ? round2(total / cur.length) : 0,
    };
  }, [paiements, factures, data, period]);

  const rows = useMemo(
    () =>
      m.cur.filter(
        (p) =>
          (mode === ALL || p.mode === mode) &&
          matches(q, p.numero, p.reference, clientName(p.clientId), facture(p.factureId)?.numero),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.cur, mode, q, data],
  );

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Paiements",
          rows: rows.map((p) => ({
            Date: fmtDate(p.date),
            Numéro: p.numero,
            Client: clientName(p.clientId),
            Facture: facture(p.factureId)?.numero ?? "",
            Mode: MODES_PAIEMENT[p.mode],
            Référence: p.reference,
            Montant: p.montant,
          })),
        },
      ],
      `paiements-${toInputDate(new Date().toISOString())}.xlsx`,
    ).then(() => toast.success("Export Excel généré."));

  const columns: Column<Paiement>[] = [
    { id: "date", header: "Date", sort: (p) => p.date, cell: (p) => fmtDate(p.date) },
    {
      id: "num",
      header: "N°",
      sort: (p) => p.numero,
      cell: (p) => <span className="font-medium tabular">{p.numero}</span>,
    },
    {
      id: "client",
      header: "Client",
      sort: (p) => clientName(p.clientId),
      cell: (p) => clientName(p.clientId),
    },
    {
      id: "fac",
      header: "Facture",
      cell: (p) => {
        const f = facture(p.factureId);
        return f ? (
          <Link
            to="/factures/$id"
            params={{ id: f.id }}
            className="font-medium text-primary hover:underline"
          >
            {f.numero}
          </Link>
        ) : (
          "—"
        );
      },
    },
    {
      id: "mode",
      header: "Mode",
      sort: (p) => p.mode,
      cell: (p) => <StatusBadge tone={MODE_TONE[p.mode]}>{MODES_PAIEMENT[p.mode]}</StatusBadge>,
    },
    {
      id: "ref",
      header: "Référence",
      cell: (p) => <span className="text-muted-foreground">{p.reference || "—"}</span>,
      hideBelow: "xl",
    },
    {
      id: "montant",
      header: "Montant",
      align: "right",
      sort: (p) => p.montant,
      cell: (p) => <span className="font-semibold text-success">{fmtMAD(p.montant)}</span>,
    },
  ];

  const periodLabel = PERIODE_LABELS[period.periode].toLowerCase();

  return (
    <div>
      <PageHeader
        title="Paiements"
        description="Encaissements clients par espèces, virement, chèque ou carte bancaire."
        actions={
          <>
            <Button variant="outline" onClick={exporter}>
              <FileSpreadsheet /> Exporter
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus /> Enregistrer un paiement
            </Button>
          </>
        }
      />

      <div className="mb-4 flex justify-end">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label={`Encaissé — ${periodLabel}`}
          value={fmtMADCompact(m.total)}
          icon={Wallet}
          evolution={evolution(m.total, m.totalPrev)}
          comparaison="vs période préc."
        />
        <KpiCard
          label="Règlements"
          value={fmtInt(m.cur.length)}
          icon={Receipt}
          footer={<span className="text-muted-foreground">sur la période</span>}
        />
        <KpiCard
          label="Règlement moyen"
          value={fmtMADCompact(m.moyenne)}
          icon={HandCoins}
          footer={<span className="text-muted-foreground">par encaissement</span>}
        />
        <KpiCard
          label="Reste à encaisser"
          value={fmtMADCompact(m.reste)}
          icon={CircleDollarSign}
          footer={
            <Link
              to="/factures"
              search={{ statut: "impayees" }}
              className="text-primary hover:underline"
            >
              Voir les factures
            </Link>
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SectionCard
          title="Répartition par mode"
          description={`Montants encaissés — ${periodLabel}`}
        >
          {m.parMode.length ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={m.parMode}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {m.parMode.map((x, i) => (
                        <Cell key={x.mode} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {m.parMode.map((x, i) => (
                  <li key={x.mode} className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="flex-1">{x.name}</span>
                    <span className="text-xs text-muted-foreground tabular">
                      {x.nb} · {fmtInt(m.total ? (x.value / m.total) * 100 : 0)} %
                    </span>
                    <span className="w-24 text-right font-medium tabular">
                      {fmtMADCompact(x.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={HandCoins}
              title="Aucun encaissement"
              description="Aucun règlement sur cette période."
            />
          )}
        </SectionCard>

        <div className="card-surface min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Client, facture, référence…"
              className="sm:w-72"
            />
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-10 bg-card sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les modes</SelectItem>
                {(Object.keys(MODES_PAIEMENT) as ModePaiement[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {MODES_PAIEMENT[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(p) => p.id}
            initialSort={{ id: "date", dir: "desc" }}
            pageSize={12}
            onRowClick={(p) => navigate({ to: "/factures/$id", params: { id: p.factureId } })}
            emptyTitle="Aucun règlement"
            emptyDescription="Modifiez la période, vos filtres ou enregistrez un nouveau paiement."
            mobileCard={(p) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{clientName(p.clientId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(p.date)} · {facture(p.factureId)?.numero ?? "—"}
                  </p>
                  <div className="mt-1">
                    <StatusBadge tone={MODE_TONE[p.mode]}>{MODES_PAIEMENT[p.mode]}</StatusBadge>
                  </div>
                </div>
                <p className="font-semibold text-success tabular">{fmtMAD(p.montant)}</p>
              </div>
            )}
          />
        </div>
      </div>

      <PaymentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
