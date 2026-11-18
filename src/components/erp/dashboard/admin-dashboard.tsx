import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Boxes, CalendarDays, PackageX, ShoppingCart, TrendingUp, UserCheck, Users, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ca, caParCategorie, caParCommercial, caParMois, syntheseStock, topProduits, ventesDans } from "@/lib/erp/analytics";
import { dansPlage, evolution, plagePeriode, plagePrecedente, round2, soldeFacture, totaux } from "@/lib/erp/calc";
import { COMMANDE_STATUTS, MODES_PAIEMENT } from "@/lib/erp/constants";
import { fmtDate, fmtInt, fmtLongDate, fmtMAD, fmtMADCompact, timeAgo } from "@/lib/erp/format";
import { useCurrentUser, useData } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import { ChartTooltip, CHART_COLORS, axisProps } from "../chart-tooltip";
import { KpiCard } from "../kpi-card";
import { PageHeader } from "../page-header";
import { PERIODE_LABELS, PeriodFilter, type PeriodValue } from "../period-filter";
import { SectionCard } from "../section-card";
import { StatusBadge } from "../status-badge";
import { UserAvatar } from "../user-menu";

export function AdminDashboard() {
  const data = useData();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodValue>({ periode: "mois" });

  const m = useMemo(() => {
    const now = new Date();
    const plage = plagePeriode(period.periode, period);
    const prev = plagePrecedente(plage);
    const cur = ventesDans(data.commandes, plage);
    const old = ventesDans(data.commandes, prev);
    const mois = plagePeriode("mois");
    const moisPrec = { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28), 23, 59, 59) };
    const jour = plagePeriode("jour");
    const hier = plagePrecedente(jour);
    const clientsActifs = new Set(cur.map((c) => c.clientId)).size;
    const clientsActifsPrev = new Set(old.map((c) => c.clientId)).size;
    const stock = syntheseStock(data);
    const encaisse = round2(data.paiements.filter((p) => dansPlage(p.date, plage)).reduce((s, p) => s + p.montant, 0));
    const encaissePrev = round2(data.paiements.filter((p) => dansPlage(p.date, prev)).reduce((s, p) => s + p.montant, 0));
    const reste = round2(data.factures.reduce((s, f) => s + soldeFacture(data, f).reste, 0));
    return {
      plage,
      caPeriode: ca(cur),
      caPrev: ca(old),
      caMois: ca(ventesDans(data.commandes, mois)),
      caMoisPrec: ca(ventesDans(data.commandes, moisPrec)),
      caJour: ca(ventesDans(data.commandes, jour)),
      caHier: ca(ventesDans(data.commandes, hier)),
      nbCmd: data.commandes.filter((c) => dansPlage(c.date, plage) && c.statut !== "annulee").length,
      nbCmdPrev: data.commandes.filter((c) => dansPlage(c.date, prev) && c.statut !== "annulee").length,
      clientsActifs,
      clientsActifsPrev,
      stock,
      encaisse,
      encaissePrev,
      reste,
      parMois: caParMois(data.commandes, now),
      parCommercial: caParCommercial(data, cur),
      parCommercialMois: caParCommercial(data, ventesDans(data.commandes, mois)),
      top: topProduits(data, cur, 10),
      parCategorie: caParCategorie(data, cur),
    };
  }, [data, period]);

  const periodLabel = PERIODE_LABELS[period.periode].toLowerCase();
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.nom ?? "—";
  const totalCat = m.parCategorie.reduce((s, x) => s + x.ca, 0);
  const stockData = [
    { name: "Disponible", value: m.stock.disponible, color: "var(--chart-1)" },
    { name: "Réservé", value: m.stock.reserve, color: "var(--chart-2)" },
  ];
  const recentCmd = [...data.commandes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recentPay = [...data.paiements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recentClients = [...data.clients].sort((a, b) => b.dateCreation.localeCompare(a.dateCreation)).slice(0, 5);
  const alertes = m.stock.lignes.filter((l) => l.etat !== "ok").sort((a, b) => a.disponible - b.disponible);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{fmtLongDate(new Date())}</span>}
        title={`Bonjour, ${user.nom.split(" ")[0]}`}
        description="Vue d'ensemble de l'activité commerciale et financière de l'entreprise."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard accent label={`Chiffre d'affaires — ${periodLabel}`} value={fmtMADCompact(m.caPeriode)} icon={TrendingUp} evolution={evolution(m.caPeriode, m.caPrev)} comparaison={`vs ${fmtMADCompact(m.caPrev)} période préc.`} />
        <KpiCard label="Chiffre d'affaires du mois" value={fmtMADCompact(m.caMois)} icon={Wallet} evolution={evolution(m.caMois, m.caMoisPrec)} comparaison="vs même date mois préc." />
        <KpiCard label="Ventes du jour" value={fmtMADCompact(m.caJour)} icon={CalendarDays} evolution={evolution(m.caJour, m.caHier)} comparaison={`hier : ${fmtMADCompact(m.caHier)}`} />
        <KpiCard label="Commandes" value={fmtInt(m.nbCmd)} icon={ShoppingCart} evolution={evolution(m.nbCmd, m.nbCmdPrev)} comparaison={`vs ${m.nbCmdPrev} période préc.`} />
        <KpiCard label="Clients actifs" value={fmtInt(m.clientsActifs)} icon={Users} evolution={evolution(m.clientsActifs, m.clientsActifsPrev)} comparaison={`sur ${data.clients.length} clients`} />
        <KpiCard label="Commerciaux" value={fmtInt(data.users.filter((u) => u.role === "commercial" && u.actif).length)} icon={UserCheck} footer={<span className="text-muted-foreground">équipe active</span>} />
        <KpiCard label="Valeur du stock" value={fmtMADCompact(m.stock.valeur)} icon={Boxes} footer={<span className="text-muted-foreground">{fmtInt(m.stock.m2)} m² en dépôt</span>} />
        <KpiCard label="Produits en stock faible" value={fmtInt(m.stock.faible + m.stock.rupture)} icon={AlertTriangle} footer={<span className="text-destructive">dont {m.stock.rupture} en rupture</span>} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
        <div className="card-surface flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Encaissements — {periodLabel}</p>
            <p className="text-lg font-semibold tabular">{fmtMAD(m.encaisse)}</p>
          </div>
          <StatusBadge tone={m.encaisse >= m.encaissePrev ? "success" : "warning"}>{m.encaisse >= m.encaissePrev ? "En hausse" : "En baisse"} vs période préc.</StatusBadge>
        </div>
        <Link to="/factures" search={{ statut: "impayees" }} className="card-surface flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-elevated">
          <div>
            <p className="text-xs text-muted-foreground">Reste à encaisser (toutes factures)</p>
            <p className="text-lg font-semibold tabular">{fmtMAD(m.reste)}</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Évolution du chiffre d'affaires" description="12 derniers mois — commandes confirmées et livrées (TTC)">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.parMois} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="caFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="mois" {...axisProps} />
                <YAxis {...axisProps} width={56} tickFormatter={(v) => fmtMADCompact(v).replace(" DH", "")} />
                <Tooltip content={<ChartTooltip money={["ca"]} />} />
                <Area type="monotone" dataKey="ca" name="Chiffre d'affaires" stroke="var(--chart-1)" strokeWidth={2.2} fill="url(#caFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Répartition par catégorie" description={`Ventes — ${periodLabel}`}>
          {m.parCategorie.length ? (
            <>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={m.parCategorie} dataKey="ca" nameKey="categorie" innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                      {m.parCategorie.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {m.parCategorie.map((c, i) => (
                  <li key={c.categorie} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate">{c.categorie}</span>
                    <span className="ml-auto tabular text-muted-foreground">{totalCat ? Math.round((c.ca / totalCat) * 100) : 0} %</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Performance des commerciaux" description={`Chiffre d'affaires — ${periodLabel}`} action={<Button asChild variant="ghost" size="sm"><Link to="/commerciaux">Détails <ArrowRight /></Link></Button>}>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.parCommercial} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="prenom" {...axisProps} />
                <YAxis {...axisProps} width={56} tickFormatter={(v) => fmtMADCompact(v).replace(" DH", "")} />
                <Tooltip cursor={{ fill: "var(--accent)" }} content={<ChartTooltip money={["ca"]} />} />
                <Bar dataKey="ca" name="Chiffre d'affaires" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {m.parCommercial.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="État du stock" description={`${m.stock.references} références · ${fmtInt(m.stock.disponible + m.stock.reserve)} cartons`} action={<Button asChild variant="ghost" size="sm"><Link to="/stocks">Stocks <ArrowRight /></Link></Button>}>
          <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stockData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {stockData.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip money={false} unit="cartons" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "Stock disponible", v: `${fmtInt(m.stock.disponible)} ct`, tone: "bg-primary-soft text-primary" },
                { l: "Stock réservé", v: `${fmtInt(m.stock.reserve)} ct`, tone: "bg-accent text-sand-foreground" },
                { l: "Stock faible", v: `${m.stock.faible} produits`, tone: "bg-warning-soft text-warning-foreground" },
                { l: "En rupture", v: `${m.stock.rupture} produit(s)`, tone: "bg-destructive-soft text-destructive" },
              ].map((x) => (
                <div key={x.l} className={`rounded-lg p-3 ${x.tone}`}>
                  <p className="text-[11px] opacity-80">{x.l}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular">{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Produits les plus vendus" description={`Top 10 — ${periodLabel} (chiffre d'affaires TTC et cartons)`}>
          {m.top.length ? (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.top} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" {...axisProps} tickFormatter={(v) => fmtMADCompact(v).replace(" DH", "")} />
                  <YAxis type="category" dataKey="court" {...axisProps} width={120} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} content={<ChartTooltip money={["ca"]} unit="cartons" />} />
                  <Bar dataKey="ca" name="Chiffre d'affaires" fill="var(--chart-1)" radius={[0, 5, 5, 0]} barSize={14} />
                  <Bar dataKey="quantite" name="Cartons vendus" fill="var(--chart-2)" radius={[0, 5, 5, 0]} barSize={6} xAxisId={0} hide />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
          )}
        </SectionCard>
        <SectionCard title="Meilleurs commerciaux" description="Objectif mensuel — mois en cours">
          <ol className="space-y-4">
            {m.parCommercialMois.map((c, i) => {
              const pct = c.objectif ? Math.round((c.ca / c.objectif) * 100) : 0;
              const u = data.users.find((x) => x.id === c.id);
              return (
                <li key={c.id}>
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <UserAvatar nom={c.nom} avatar={u?.avatar} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nom}</p>
                      <p className="text-xs text-muted-foreground tabular">
                        {fmtMADCompact(c.ca)} / {fmtMADCompact(c.objectif)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular">{pct} %</span>
                  </div>
                  <Progress value={Math.min(100, pct)} className="mt-2 h-1.5" />
                </li>
              );
            })}
          </ol>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Dernières commandes" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/commandes">Tout voir</Link></Button>}>
          <ul className="divide-y">
            {recentCmd.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => navigate({ to: "/commandes/$id", params: { id: c.id } })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{clientName(c.clientId)}</p>
                    <p className="text-xs text-muted-foreground">{c.numero} · {fmtDate(c.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular">{fmtMADCompact(totaux(c).ttc)}</p>
                    <StatusBadge tone={COMMANDE_STATUTS[c.statut].tone} withDot={false} className="mt-0.5 px-2 text-[10px]">{COMMANDE_STATUTS[c.statut].label}</StatusBadge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Derniers paiements" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/paiements">Tout voir</Link></Button>}>
          <ul className="divide-y">
            {recentPay.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success"><Wallet className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{clientName(p.clientId)}</p>
                  <p className="text-xs text-muted-foreground">{MODES_PAIEMENT[p.mode]} · {fmtDate(p.date)}</p>
                </div>
                <p className="text-sm font-semibold text-success tabular">+{fmtMADCompact(p.montant)}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Clients récemment ajoutés" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/clients">Tout voir</Link></Button>}>
          <ul className="divide-y">
            {recentClients.map((c) => (
              <li key={c.id}>
                <Link to="/clients/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 md:px-5">
                  <UserAvatar nom={c.nom} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nom}</p>
                    <p className="text-xs text-muted-foreground">{c.type} · {c.ville}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDate(c.dateCreation)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Alertes de stock" description={`${alertes.length} produit(s) sous le seuil minimal`} bodyClassName="p-0">
          <ul className="divide-y">
            {alertes.map((a) => (
              <li key={a.product.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <img src={productImage(a.product.image)} alt="" className="size-10 rounded-md object-cover" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.product.nom}</p>
                  <p className="text-xs text-muted-foreground">{a.product.dimension} · seuil {a.product.seuilMin} ct</p>
                </div>
                <StatusBadge tone={a.etat === "rupture" ? "danger" : "warning"}>
                  {a.etat === "rupture" ? <><PackageX className="size-3" /> Rupture</> : `${a.disponible} ct dispo.`}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Activités récentes" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/activites">Journal</Link></Button>}>
          <ul className="divide-y">
            {data.activites.slice(0, 7).map((a) => {
              const u = data.users.find((x) => x.id === a.userId);
              return (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                  <UserAvatar nom={u?.nom ?? "?"} avatar={u?.avatar} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-medium">{u?.nom}</span> <span className="text-muted-foreground">— {a.description}</span></p>
                    <p className="text-[11px] text-muted-foreground">{a.action} · {timeAgo(a.date)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
