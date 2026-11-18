import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Download,
  FileDown,
  Printer,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartTooltip, CHART_COLORS, axisProps } from "@/components/erp/chart-tooltip";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { PERIODE_LABELS, PeriodFilter, type PeriodValue } from "@/components/erp/period-filter";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import {
  caParCategorie,
  caParCommercial,
  caParMois,
  syntheseStock,
  topProduits,
} from "@/lib/erp/analytics";
import { dansPlage, estVente, plagePeriode, round2, soldeFacture, totaux } from "@/lib/erp/calc";
import { CATEGORIES, CLIENT_TYPES, COMMANDE_STATUTS, MODES_PAIEMENT } from "@/lib/erp/constants";
import { exportElementToPdf, exportXlsx } from "@/lib/erp/export";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact, fmtQty } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useData } from "@/lib/erp/hooks";
import type { CommandeStatut, ModePaiement } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/rapports")({
  head: pageHead(
    "Rapports",
    "Rapports de chiffre d'affaires, ventes, produits, clients, commerciaux, stocks et paiements.",
  ),
  component: RapportsPage,
});

const ALL = "__all";
const SECTIONS = [
  { id: "ca", label: "Chiffre d'affaires" },
  { id: "ventes", label: "Ventes" },
  { id: "produits", label: "Produits" },
  { id: "clients", label: "Clients" },
  { id: "commerciaux", label: "Commerciaux" },
  { id: "stocks", label: "Stocks" },
  { id: "paiements", label: "Paiements" },
] as const;

const moneyAxis = {
  ...axisProps,
  tickFormatter: (v: number) => fmtMADCompact(v).replace(" DH", ""),
};

function RapportsPage() {
  const data = useData();
  const [period, setPeriod] = useState<PeriodValue>({ periode: "annee" });
  const [commercial, setCommercial] = useState(ALL);
  const [section, setSection] = useState<string>("ca");
  const printRef = useRef<HTMLDivElement>(null);
  const commerciaux = data.users.filter((u) => u.role === "commercial");

  const r = useMemo(() => {
    const now = new Date();
    const plage = plagePeriode(period.periode, period);
    const cmdsAll = data.commandes.filter(
      (c) => commercial === ALL || c.commercialId === commercial,
    );
    const cmds = cmdsAll.filter((c) => dansPlage(c.date, plage));
    const ventes = cmds.filter(estVente);
    const t = ventes.reduce(
      (s, c) => {
        const x = totaux(c);
        return { ht: s.ht + x.ht, tva: s.tva + x.tva, ttc: s.ttc + x.ttc };
      },
      { ht: 0, tva: 0, ttc: 0 },
    );
    const devis = data.devis.filter(
      (d) => (commercial === ALL || d.commercialId === commercial) && dansPlage(d.date, plage),
    );
    const devisAcceptes = devis.filter((d) => d.statut === "accepte" || d.commandeId).length;
    const parStatut = (Object.keys(COMMANDE_STATUTS) as CommandeStatut[]).map((s) => {
      const list = cmds.filter((c) => c.statut === s);
      return {
        statut: COMMANDE_STATUTS[s].label,
        nombre: list.length,
        montant: round2(list.reduce((a, c) => a + totaux(c).ttc, 0)),
      };
    });
    const devisParStatut = (["brouillon", "envoye", "accepte", "refuse", "expire"] as const).map(
      (s) => ({
        statut: {
          brouillon: "Brouillon",
          envoye: "Envoyé",
          accepte: "Accepté",
          refuse: "Refusé",
          expire: "Expiré",
        }[s],
        nombre: devis.filter((d) => d.statut === s).length,
      }),
    );

    // Clients
    const parClient = new Map<string, number>();
    for (const c of ventes)
      parClient.set(c.clientId, (parClient.get(c.clientId) ?? 0) + totaux(c).ttc);
    const topClients = [...parClient.entries()]
      .map(([id, v]) => {
        const cl = data.clients.find((x) => x.id === id);
        return {
          id,
          nom: cl?.nom ?? "—",
          ville: cl?.ville ?? "—",
          type: cl?.type ?? "—",
          ca: round2(v),
          commandes: ventes.filter((c) => c.clientId === id).length,
        };
      })
      .sort((a, b) => b.ca - a.ca);
    const parType = CLIENT_TYPES.map((ty) => ({
      type: ty,
      ca: round2(topClients.filter((c) => c.type === ty).reduce((s, c) => s + c.ca, 0)),
    })).filter((x) => x.ca > 0);
    const villes = new Map<string, number>();
    for (const c of topClients) villes.set(c.ville, (villes.get(c.ville) ?? 0) + c.ca);
    const parVille = [...villes.entries()]
      .map(([ville, v]) => ({ ville, ca: round2(v) }))
      .sort((a, b) => b.ca - a.ca);

    // Commerciaux : objectif proratisé sur la durée de la période
    const jours = Math.max(1, Math.round((plage.end.getTime() - plage.start.getTime()) / 86400000));
    const facteurObjectif = Math.max(1, jours / 30.4);
    const equipe = caParCommercial(
      data,
      data.commandes.filter((c) => dansPlage(c.date, plage)),
    ).map((x) => ({
      ...x,
      objectifPeriode: round2(x.objectif * facteurObjectif),
      taux: x.objectif ? (x.ca / (x.objectif * facteurObjectif)) * 100 : 0,
    }));

    // Stocks
    const stock = syntheseStock(data);
    const valeurCategorie = CATEGORIES.map((cat) => ({
      categorie: cat,
      valeur: round2(
        stock.lignes
          .filter((l) => l.product.categorie === cat)
          .reduce((s, l) => s + l.physique * l.product.prixCarton, 0),
      ),
    })).filter((x) => x.valeur > 0);

    // Paiements
    const factures = data.factures.filter(
      (f) => commercial === ALL || f.commercialId === commercial,
    );
    const fIds = new Set(factures.map((f) => f.id));
    const paiements = data.paiements.filter(
      (p) => fIds.has(p.factureId) && dansPlage(p.date, plage),
    );
    const parMode = (Object.keys(MODES_PAIEMENT) as ModePaiement[]).map((m) => ({
      mode: MODES_PAIEMENT[m],
      montant: round2(paiements.filter((p) => p.mode === m).reduce((s, p) => s + p.montant, 0)),
    }));
    const impayees = factures
      .map((f) => ({
        f,
        ...soldeFacture(data, f),
        age: Math.floor((now.getTime() - new Date(f.date).getTime()) / 86400000),
        retard: new Date(f.echeance) < now,
      }))
      .filter((x) => x.reste > 0.009)
      .sort((a, b) => b.age - a.age);
    const balance = [
      {
        tranche: "0 à 30 jours",
        montant: round2(impayees.filter((x) => x.age <= 30).reduce((s, x) => s + x.reste, 0)),
      },
      {
        tranche: "31 à 60 jours",
        montant: round2(
          impayees.filter((x) => x.age > 30 && x.age <= 60).reduce((s, x) => s + x.reste, 0),
        ),
      },
      {
        tranche: "Plus de 60 jours",
        montant: round2(impayees.filter((x) => x.age > 60).reduce((s, x) => s + x.reste, 0)),
      },
    ];

    return {
      plage,
      t: { ht: round2(t.ht), tva: round2(t.tva), ttc: round2(t.ttc) },
      nbVentes: ventes.length,
      panier: ventes.length ? round2(t.ttc / ventes.length) : 0,
      parMois: caParMois(cmdsAll, now, 12),
      parStatut,
      devis: devis.length,
      devisAcceptes,
      conversion: devis.length ? (devisAcceptes / devis.length) * 100 : 0,
      devisParStatut,
      top: topProduits(data, ventes, 10),
      parCategorie: caParCategorie(data, ventes),
      topClients,
      parType,
      parVille,
      equipe,
      stock,
      valeurCategorie,
      encaisse: round2(paiements.reduce((s, p) => s + p.montant, 0)),
      parMode,
      impayees,
      balance,
    };
  }, [data, period, commercial]);

  const periodLabel =
    period.periode === "perso" && period.from
      ? `du ${fmtDate(r.plage.start.toISOString())} au ${fmtDate(r.plage.end.toISOString())}`
      : PERIODE_LABELS[period.periode].toLowerCase();
  const nomCommercial =
    commercial === ALL
      ? "Toute l'équipe"
      : (commerciaux.find((u) => u.id === commercial)?.nom ?? "");

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Synthèse",
          rows: [
            {
              Période: periodLabel,
              Périmètre: nomCommercial,
              "CA HT": r.t.ht,
              TVA: r.t.tva,
              "CA TTC": r.t.ttc,
              Ventes: r.nbVentes,
              "Panier moyen": r.panier,
              "Taux de conversion devis (%)": round2(r.conversion),
              Encaissements: r.encaisse,
            },
          ],
        },
        {
          name: "CA mensuel",
          rows: r.parMois.map((m) => ({ Mois: m.mois, "CA TTC": m.ca, Commandes: m.commandes })),
        },
        {
          name: "Commandes par statut",
          rows: r.parStatut.map((s) => ({
            Statut: s.statut,
            Nombre: s.nombre,
            "Montant TTC": s.montant,
          })),
        },
        {
          name: "Top produits",
          rows: r.top.map((p) => ({ Produit: p.nom, Cartons: p.quantite, "CA TTC": p.ca })),
        },
        {
          name: "CA par catégorie",
          rows: r.parCategorie.map((c) => ({ Catégorie: c.categorie, "CA TTC": c.ca })),
        },
        {
          name: "Clients",
          rows: r.topClients.map((c) => ({
            Client: c.nom,
            Type: c.type,
            Ville: c.ville,
            Commandes: c.commandes,
            "CA TTC": c.ca,
          })),
        },
        {
          name: "Commerciaux",
          rows: r.equipe.map((c) => ({
            Commercial: c.nom,
            "CA TTC": c.ca,
            Commandes: c.commandes,
            "Objectif période": c.objectifPeriode,
            "Réalisation (%)": round2(c.taux),
          })),
        },
        {
          name: "Stock",
          rows: r.stock.lignes.map((l) => ({
            Produit: l.product.nom,
            Physique: l.physique,
            Réservé: l.reserve,
            Disponible: l.disponible,
            "Valeur (DH)": round2(l.physique * l.product.prixCarton),
          })),
        },
        {
          name: "Impayés",
          rows: r.impayees.map((x) => ({
            Facture: x.f.numero,
            Client: data.clients.find((c) => c.id === x.f.clientId)?.nom ?? "—",
            Date: fmtDate(x.f.date),
            Échéance: fmtDate(x.f.echeance),
            TTC: x.ttc,
            Payé: x.paye,
            Reste: x.reste,
            "Âge (jours)": x.age,
          })),
        },
      ],
      `rapport-${new Date().toISOString().slice(0, 10)}.xlsx`,
    ).then(() => toast.success("Rapport Excel généré."));

  const pdf = async () => {
    if (!printRef.current) return;
    toast.info("Génération du PDF en cours…");
    await exportElementToPdf(
      printRef.current,
      `rapport-${section}-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    toast.success("PDF téléchargé.");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rapports"
        description={`Analyse de l'activité — ${periodLabel} · ${nomCommercial}`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Imprimer
            </Button>
            <Button variant="outline" onClick={pdf}>
              <FileDown /> PDF
            </Button>
            <Button onClick={exporter}>
              <Download /> Export Excel
            </Button>
          </>
        }
      />

      <div className="card-surface flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <PeriodFilter value={period} onChange={setPeriod} />
        <Select value={commercial} onValueChange={setCommercial}>
          <SelectTrigger className="h-9 bg-card lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toute l'équipe commerciale</SelectItem>
            {commerciaux.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="CA TTC"
          value={fmtMADCompact(r.t.ttc)}
          icon={TrendingUp}
          footer={<span className="text-primary-foreground/70">HT : {fmtMADCompact(r.t.ht)}</span>}
        />
        <KpiCard
          label="Ventes"
          value={fmtInt(r.nbVentes)}
          icon={ShoppingBag}
          footer={
            <span className="text-muted-foreground">panier moyen {fmtMADCompact(r.panier)}</span>
          }
        />
        <KpiCard
          label="Conversion des devis"
          value={`${fmtQty(Math.round(r.conversion))} %`}
          icon={Receipt}
          footer={
            <span className="text-muted-foreground">
              {r.devisAcceptes} acceptés sur {r.devis}
            </span>
          }
        />
        <KpiCard
          label="Encaissements"
          value={fmtMADCompact(r.encaisse)}
          icon={Wallet}
          footer={
            <span className="text-destructive">
              {fmtMADCompact(r.impayees.reduce((s, x) => s + x.reste, 0))} à encaisser
            </span>
          }
        />
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            {SECTIONS.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div ref={printRef} className="print-root mt-4 bg-background">
          <div className="mb-4 hidden print:block">
            <p className="text-lg font-semibold">
              Rapport — {SECTIONS.find((s) => s.id === section)?.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {periodLabel} · {nomCommercial} · édité le {fmtDate(new Date().toISOString())}
            </p>
          </div>

          <TabsContent value="ca" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Chiffre d'affaires HT" value={fmtMAD(r.t.ht)} />
              <Stat label="TVA collectée" value={fmtMAD(r.t.tva)} />
              <Stat label="Chiffre d'affaires TTC" value={fmtMAD(r.t.ttc)} strong />
            </div>
            <SectionCard
              title="Évolution mensuelle du chiffre d'affaires"
              description="12 derniers mois — TTC"
            >
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <BarChart data={r.parMois} margin={{ left: -8, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="mois" {...axisProps} />
                    <YAxis {...moneyAxis} width={56} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                    />
                    <Bar dataKey="ca" name="CA TTC" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Nombre de ventes par mois">
              <div className="h-[220px]">
                <ResponsiveContainer>
                  <LineChart data={r.parMois} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="mois" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip money={false} unit="commandes" />} />
                    <Line
                      type="monotone"
                      dataKey="commandes"
                      name="Commandes"
                      stroke="var(--chart-2)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="ventes" className="mt-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Commandes par statut" description={periodLabel}>
                <ul className="divide-y">
                  {r.parStatut.map((s) => (
                    <li
                      key={s.statut}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span>{s.statut}</span>
                      <span className="tabular text-muted-foreground">
                        <b className="text-foreground">{s.nombre}</b> · {fmtMAD(s.montant)}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard
                title="Devis"
                description={`Taux de conversion : ${fmtQty(Math.round(r.conversion))} %`}
              >
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <BarChart
                      data={r.devisParStatut}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" {...axisProps} allowDecimals={false} />
                      <YAxis type="category" dataKey="statut" {...axisProps} width={80} />
                      <Tooltip
                        content={<ChartTooltip money={false} unit="devis" />}
                        cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                      />
                      <Bar dataKey="nombre" name="Devis" radius={[0, 6, 6, 0]}>
                        {r.devisParStatut.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="produits" className="mt-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <SectionCard
                title="Produits les plus vendus"
                description="Classement par chiffre d'affaires TTC"
                bodyClassName="p-0"
              >
                <ul className="divide-y">
                  {r.top.length === 0 && (
                    <li className="p-5 text-sm text-muted-foreground">
                      Aucune vente sur la période.
                    </li>
                  )}
                  {r.top.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm md:px-5">
                      <span className="w-5 text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{p.nom}</span>
                      <span className="text-xs text-muted-foreground tabular">
                        {fmtInt(p.quantite)} ct
                      </span>
                      <span className="w-28 text-right font-semibold tabular">
                        {fmtMADCompact(p.ca)}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard title="Répartition par catégorie">
                <PieBlock data={r.parCategorie.map((c) => ({ name: c.categorie, value: c.ca }))} />
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="clients" className="mt-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="CA par type de client">
                <PieBlock data={r.parType.map((c) => ({ name: c.type, value: c.ca }))} />
              </SectionCard>
              <SectionCard title="CA par ville">
                <div className="h-[260px]">
                  <ResponsiveContainer>
                    <BarChart data={r.parVille} margin={{ left: -8, right: 8 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="ville" {...axisProps} />
                      <YAxis {...moneyAxis} width={56} />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                      />
                      <Bar dataKey="ca" name="CA TTC" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
            <SectionCard title="Meilleurs clients" bodyClassName="p-0">
              <ul className="divide-y">
                {r.topClients.slice(0, 10).map((c, i) => (
                  <li key={c.id}>
                    <Link
                      to="/clients/$id"
                      params={{ id: c.id }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/40 md:px-5"
                    >
                      <span className="w-5 text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.nom}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.type} · {c.ville} · {c.commandes} commande(s)
                        </span>
                      </span>
                      <span className="font-semibold tabular">{fmtMADCompact(c.ca)}</span>
                    </Link>
                  </li>
                ))}
                {r.topClients.length === 0 && (
                  <li className="p-5 text-sm text-muted-foreground">
                    Aucune vente sur la période.
                  </li>
                )}
              </ul>
            </SectionCard>
          </TabsContent>

          <TabsContent value="commerciaux" className="mt-0 space-y-4">
            <SectionCard
              title="Chiffre d'affaires et objectifs"
              description="Objectif mensuel proratisé sur la période"
            >
              <div className="h-[280px]">
                <ResponsiveContainer>
                  <BarChart data={r.equipe} margin={{ left: -8, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="prenom" {...axisProps} />
                    <YAxis {...moneyAxis} width={56} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="ca"
                      name="CA réalisé"
                      fill="var(--chart-1)"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="objectifPeriode"
                      name="Objectif"
                      fill="var(--chart-2)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Classement" bodyClassName="p-0">
              <ul className="divide-y">
                {r.equipe.map((c, i) => (
                  <li
                    key={c.id}
                    className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center md:px-5"
                  >
                    <span className="font-medium">
                      <span className="mr-2 text-xs text-muted-foreground">{i + 1}</span>
                      {c.nom}
                      {!c.actif && (
                        <StatusBadge tone="neutral" className="ml-2">
                          Inactif
                        </StatusBadge>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, c.taux)} className="h-2" />
                      <span className="w-12 text-right text-xs tabular">
                        {fmtQty(Math.round(c.taux))} %
                      </span>
                    </div>
                    <span className="text-right font-semibold tabular">
                      {fmtMAD(c.ca)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {c.commandes} cmd
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </TabsContent>

          <TabsContent value="stocks" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Valeur totale du stock" value={fmtMAD(r.stock.valeur)} strong />
              <Stat label="Surface en dépôt" value={`${fmtInt(r.stock.m2)} m²`} />
              <Stat
                label="Produits en alerte"
                value={`${r.stock.faible} faibles · ${r.stock.rupture} ruptures`}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Valeur du stock par catégorie">
                <PieBlock
                  data={r.valeurCategorie.map((c) => ({ name: c.categorie, value: c.valeur }))}
                />
              </SectionCard>
              <SectionCard
                title="Produits en alerte"
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/stocks" search={{ onglet: "alertes" }}>
                      Voir
                    </Link>
                  </Button>
                }
                bodyClassName="p-0"
              >
                <ul className="divide-y">
                  {r.stock.lignes
                    .filter((l) => l.etat !== "ok")
                    .map((l) => (
                      <li
                        key={l.product.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm md:px-5"
                      >
                        <span className="truncate">{l.product.nom}</span>
                        <StatusBadge tone={l.etat === "rupture" ? "danger" : "warning"}>
                          {l.disponible} ct / seuil {l.product.seuilMin}
                        </StatusBadge>
                      </li>
                    ))}
                  {r.stock.faible + r.stock.rupture === 0 && (
                    <li className="p-5 text-sm text-muted-foreground">Aucune alerte de stock.</li>
                  )}
                </ul>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="paiements" className="mt-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard
                title="Encaissements par mode de paiement"
                description={`${fmtMAD(r.encaisse)} — ${periodLabel}`}
              >
                <PieBlock
                  data={r.parMode
                    .filter((m) => m.montant > 0)
                    .map((m) => ({ name: m.mode, value: m.montant }))}
                />
              </SectionCard>
              <SectionCard
                title="Balance âgée des créances"
                description="Reste à encaisser selon l'ancienneté des factures"
              >
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <BarChart data={r.balance} margin={{ left: -8, right: 8 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="tranche" {...axisProps} />
                      <YAxis {...moneyAxis} width={56} />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                      />
                      <Bar dataKey="montant" name="Reste à encaisser" radius={[6, 6, 0, 0]}>
                        <Cell fill="var(--chart-4)" />
                        <Cell fill="var(--chart-2)" />
                        <Cell fill="var(--chart-5)" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
            <SectionCard
              title="Factures impayées"
              description={`${r.impayees.length} facture(s) · dont ${r.impayees.filter((x) => x.retard).length} en retard`}
              bodyClassName="p-0"
            >
              <ul className="divide-y">
                {r.impayees.slice(0, 15).map((x) => (
                  <li key={x.f.id}>
                    <Link
                      to="/factures/$id"
                      params={{ id: x.f.id }}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-accent/40 md:px-5"
                    >
                      <span className="font-medium tabular">{x.f.numero}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {data.clients.find((c) => c.id === x.f.clientId)?.nom}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        échéance {fmtDate(x.f.echeance)}
                      </span>
                      {x.retard ? (
                        <StatusBadge tone="danger">En retard</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">À échoir</StatusBadge>
                      )}
                      <span className="w-28 text-right font-semibold tabular">
                        {fmtMAD(x.reste)}
                      </span>
                    </Link>
                  </li>
                ))}
                {r.impayees.length === 0 && (
                  <li className="p-5 text-sm text-muted-foreground">Aucune facture impayée.</li>
                )}
              </ul>
            </SectionCard>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={strong ? "rounded-xl bg-primary p-4 text-primary-foreground" : "card-surface p-4"}
    >
      <p
        className={strong ? "text-xs text-primary-foreground/70" : "text-xs text-muted-foreground"}
      >
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

function PieBlock({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, x) => s + x.value, 0);
  if (!total)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucune donnée sur la période.
      </p>
    );
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
      <div className="mx-auto h-[180px] w-[180px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={84}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="text-xs text-muted-foreground tabular">
              {fmtQty(Math.round((d.value / total) * 1000) / 10)} %
            </span>
            <span className="w-20 text-right font-medium tabular">{fmtMADCompact(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
