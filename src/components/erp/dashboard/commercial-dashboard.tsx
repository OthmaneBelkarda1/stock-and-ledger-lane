import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, FileClock, FileText, Gauge, Plus, ShoppingCart, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ca, caParMois, topProduits, ventesDans } from "@/lib/erp/analytics";
import { dansPlage, evolution, plagePeriode, plagePrecedente, totaux } from "@/lib/erp/calc";
import { COMMANDE_STATUTS, DEVIS_STATUTS } from "@/lib/erp/constants";
import { fmtDate, fmtInt, fmtLongDate, fmtMAD, fmtMADCompact, timeAgo } from "@/lib/erp/format";
import { useNotifications, useScoped } from "@/lib/erp/hooks";
import { ChartTooltip, axisProps } from "../chart-tooltip";
import { KpiCard } from "../kpi-card";
import { NotifIcon } from "../notif-icon";
import { PageHeader } from "../page-header";
import { PERIODE_LABELS, PeriodFilter, type PeriodValue } from "../period-filter";
import { SectionCard } from "../section-card";
import { StatusBadge } from "../status-badge";
import { UserAvatar } from "../user-menu";

export function CommercialDashboard() {
  const { data, user, clients, devis, commandes } = useScoped();
  const { list: notifs } = useNotifications();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodValue>({ periode: "mois" });

  const m = useMemo(() => {
    const now = new Date();
    const plage = plagePeriode(period.periode, period);
    const prev = plagePrecedente(plage);
    const cur = ventesDans(commandes, plage);
    const old = ventesDans(commandes, prev);
    const mois = ventesDans(commandes, plagePeriode("mois"));
    const moisPrec = ventesDans(commandes, { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28), 23, 59, 59) });
    const caMois = ca(mois);
    return {
      caPeriode: ca(cur),
      caPrev: ca(old),
      caMois,
      caMoisPrec: ca(moisPrec),
      nbCmd: commandes.filter((c) => dansPlage(c.date, plage) && c.statut !== "annulee").length,
      nbCmdPrev: commandes.filter((c) => dansPlage(c.date, prev) && c.statut !== "annulee").length,
      devisAttente: devis.filter((d) => d.statut === "envoye" || d.statut === "brouillon"),
      taux: user.objectifMensuel ? Math.round((caMois / user.objectifMensuel) * 100) : 0,
      parMois: caParMois(commandes, now),
      top: topProduits(data, cur, 6),
    };
  }, [commandes, devis, data, period, user.objectifMensuel]);

  const periodLabel = PERIODE_LABELS[period.periode].toLowerCase();
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.nom ?? "—";
  const restant = Math.max(0, user.objectifMensuel - m.caMois);
  const recentCmd = [...commandes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentDevis = [...devis].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentClients = [...clients].sort((a, b) => b.dateCreation.localeCompare(a.dateCreation)).slice(0, 5);
  const mesActivites = data.activites.filter((a) => a.userId === user.id).slice(0, 6);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{fmtLongDate(new Date())}</span>}
        title={`Bonjour, ${user.nom.split(" ")[0]}`}
        description="Votre espace commercial : vos résultats, vos clients et vos opérations en cours."
        actions={
          <>
            <PeriodFilter value={period} onChange={setPeriod} />
            <Button asChild size="sm" className="h-8">
              <Link to="/devis/nouveau"><Plus /> Nouveau devis</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard accent label={`Mon chiffre d'affaires — ${periodLabel}`} value={fmtMADCompact(m.caPeriode)} icon={TrendingUp} evolution={evolution(m.caPeriode, m.caPrev)} comparaison="vs période préc." />
        <KpiCard label="Mes ventes du mois" value={fmtMADCompact(m.caMois)} icon={Wallet} evolution={evolution(m.caMois, m.caMoisPrec)} comparaison="vs même date mois préc." />
        <KpiCard label="Mes commandes" value={fmtInt(m.nbCmd)} icon={ShoppingCart} evolution={evolution(m.nbCmd, m.nbCmdPrev)} comparaison={periodLabel} />
        <KpiCard label="Mes clients" value={fmtInt(clients.length)} icon={Users} footer={<span className="text-muted-foreground">portefeuille attribué</span>} />
        <KpiCard label="Mes devis en attente" value={fmtInt(m.devisAttente.length)} icon={FileClock} footer={<span className="text-muted-foreground tabular">{fmtMADCompact(m.devisAttente.reduce((s, d) => s + totaux(d).ttc, 0))} en jeu</span>} />
        <KpiCard label="Mon objectif mensuel" value={fmtMADCompact(user.objectifMensuel)} icon={Target} footer={<span className="text-muted-foreground tabular">reste {fmtMADCompact(restant)}</span>} />
        <KpiCard label="Mon taux de réalisation" value={`${m.taux} %`} icon={Gauge} footer={<span className={m.taux >= 100 ? "text-success" : "text-muted-foreground"}>{m.taux >= 100 ? "Objectif atteint" : "du mois en cours"}</span>} />
        <KpiCard label="Devis acceptés (total)" value={fmtInt(devis.filter((d) => d.statut === "accepte").length)} icon={FileText} footer={<span className="text-muted-foreground">sur {devis.length} devis</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Évolution de mes ventes" description="12 derniers mois (TTC)">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.parMois} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="myFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="mois" {...axisProps} />
                <YAxis {...axisProps} width={56} tickFormatter={(v) => fmtMADCompact(v).replace(" DH", "")} />
                <Tooltip content={<ChartTooltip money={["ca"]} />} />
                <Area type="monotone" dataKey="ca" name="Mes ventes" stroke="var(--chart-1)" strokeWidth={2.2} fill="url(#myFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Progression de mon objectif" description="Mois en cours">
          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ v: Math.min(100, m.taux) }]} startAngle={210} endAngle={-30}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="v" cornerRadius={12} fill="var(--chart-1)" background={{ fill: "var(--secondary)" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-semibold tabular">{m.taux} %</p>
              <p className="text-xs text-muted-foreground">réalisé</p>
            </div>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Réalisé</dt><dd className="font-semibold tabular">{fmtMAD(m.caMois)}</dd></div>
            <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Objectif</dt><dd className="font-semibold tabular">{fmtMAD(user.objectifMensuel)}</dd></div>
          </dl>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Évolution de mes commandes" description="Nombre de commandes par mois">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.parMois} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="mois" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--accent)" }} content={<ChartTooltip money={false} />} />
                <Bar dataKey="commandes" name="Commandes" fill="var(--chart-2)" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Mes produits les plus vendus" description={periodLabel}>
          {m.top.length ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.top} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" {...axisProps} tickFormatter={(v) => fmtMADCompact(v).replace(" DH", "")} />
                  <YAxis type="category" dataKey="court" {...axisProps} width={110} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} content={<ChartTooltip money={["ca"]} />} />
                  <Bar dataKey="ca" name="Chiffre d'affaires" fill="var(--chart-1)" radius={[0, 5, 5, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Mes dernières commandes" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/commandes">Tout voir</Link></Button>}>
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
        <SectionCard title="Mes derniers devis" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/devis">Tout voir</Link></Button>}>
          <ul className="divide-y">
            {recentDevis.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => navigate({ to: "/devis/$id", params: { id: d.id } })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{clientName(d.clientId)}</p>
                    <p className="text-xs text-muted-foreground">{d.numero} · {fmtDate(d.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular">{fmtMADCompact(totaux(d).ttc)}</p>
                    <StatusBadge tone={DEVIS_STATUTS[d.statut].tone} withDot={false} className="mt-0.5 px-2 text-[10px]">{DEVIS_STATUTS[d.statut].label}</StatusBadge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Mes clients récents" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/clients">Tout voir</Link></Button>}>
          <ul className="divide-y">
            {recentClients.map((c) => (
              <li key={c.id}>
                <Link to="/clients/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 md:px-5">
                  <UserAvatar nom={c.nom} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nom}</p>
                    <p className="text-xs text-muted-foreground">{c.type} · {c.ville}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Mes notifications" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/notifications">Tout voir</Link></Button>}>
          <ul className="divide-y">
            {notifs.slice(0, 5).map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                <NotifIcon niveau={n.niveau} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.titre}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.date)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Mes activités récentes" bodyClassName="p-0" action={<Button asChild variant="ghost" size="sm"><Link to="/activites">Historique</Link></Button>}>
          {mesActivites.length ? (
            <ul className="divide-y">
              {mesActivites.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <span className="size-2 rounded-full bg-sand" />
                  <p className="min-w-0 flex-1 truncate text-sm">{a.description}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Aucune activité récente.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
