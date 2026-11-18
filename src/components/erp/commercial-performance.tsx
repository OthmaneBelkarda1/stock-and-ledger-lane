import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Award, FileCheck2, ShoppingBag, Target, TrendingUp, Trophy } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ca, caParMois, topProduits, ventesDans } from "@/lib/erp/analytics";
import { estVente, plagePeriode, totaux } from "@/lib/erp/calc";
import { COMMANDE_STATUTS, DEVIS_STATUTS } from "@/lib/erp/constants";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact } from "@/lib/erp/format";
import { productImage } from "@/lib/erp/images";
import { cn } from "@/lib/utils";
import type { ErpData, User } from "@/lib/erp/types";
import { ChartTooltip, axisProps } from "./chart-tooltip";
import { KpiCard } from "./kpi-card";
import { SectionCard } from "./section-card";
import { StatusBadge } from "./status-badge";
import { UserAvatar } from "./user-menu";

/** Jauge semi-circulaire du taux de réalisation. */
function Gauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 80;
  const c = Math.PI * r;
  const color = value >= 100 ? "var(--success)" : value >= 60 ? "var(--chart-1)" : "var(--warning)";
  return (
    <svg
      viewBox="0 0 200 115"
      className="mx-auto w-full max-w-[260px]"
      role="img"
      aria-label={`Taux de réalisation ${value} %`}
    >
      <path
        d="M20 100 A80 80 0 0 1 180 100"
        fill="none"
        stroke="var(--muted)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M20 100 A80 80 0 0 1 180 100"
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
      />
      <text
        x="100"
        y="88"
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 30, fontWeight: 600 }}
      >
        {value} %
      </text>
      <text
        x="100"
        y="108"
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 11 }}
      >
        de l'objectif mensuel
      </text>
    </svg>
  );
}

const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

export function CommercialPerformance({
  data,
  user,
  mode,
}: {
  data: ErpData;
  user: User;
  mode: "admin" | "self";
}) {
  const navigate = useNavigate();

  const m = useMemo(() => {
    const now = new Date();
    const mois = plagePeriode("mois");
    const annee = plagePeriode("annee");
    const cmds = data.commandes.filter((c) => c.commercialId === user.id);
    const ventes = cmds.filter(estVente);
    const devis = data.devis
      .filter((d) => d.commercialId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const tranches = devis.filter(
      (d) => d.statut === "accepte" || d.statut === "refuse" || d.statut === "expire",
    );
    const acceptes = devis.filter((d) => d.statut === "accepte").length;
    const caMois = ca(ventesDans(cmds, mois));
    const moisPrec = {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    };

    // Top clients
    const parClient = new Map<string, number>();
    for (const c of ventes)
      parClient.set(c.clientId, (parClient.get(c.clientId) ?? 0) + totaux(c).ttc);
    const topClients = [...parClient.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, v]) => ({ client: data.clients.find((c) => c.id === id), ca: v, id }));

    // Classement anonymisé (commerciaux actifs, CA du mois)
    const equipe = data.users
      .filter((u) => u.role === "commercial" && u.actif)
      .map((u) => ({
        id: u.id,
        ca: ca(
          ventesDans(
            data.commandes.filter((c) => c.commercialId === u.id),
            mois,
          ),
        ),
      }))
      .sort((a, b) => b.ca - a.ca);
    const rang = equipe.findIndex((e) => e.id === user.id) + 1;

    return {
      caMois,
      caMoisPrec: ca(ventesDans(cmds, moisPrec)),
      caAnnee: ca(ventesDans(cmds, annee)),
      taux: user.objectifMensuel ? Math.round((caMois / user.objectifMensuel) * 100) : 0,
      panier: ventes.length ? ca(ventes) / ventes.length : 0,
      nbVentes: ventes.length,
      conversion: tranches.length ? Math.round((acceptes / tranches.length) * 100) : 0,
      devisEnCours: devis.filter((d) => d.statut === "envoye" || d.statut === "brouillon").length,
      parMois: caParMois(cmds, now, 12).map((x) => ({ ...x, objectif: user.objectifMensuel })),
      topClients,
      topProduits: topProduits(data, ventes, 5),
      rang,
      equipe: equipe.length,
      clients: data.clients.filter((c) => c.commercialId === user.id),
      commandes: [...cmds].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
      devis: devis.slice(0, 6),
    };
  }, [data, user]);

  const restant = Math.max(0, user.objectifMensuel - m.caMois);
  const jour = new Date().getDate();
  const joursMois = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projection = jour ? (m.caMois / jour) * joursMois : 0;
  const evo = m.caMoisPrec
    ? ((m.caMois - m.caMoisPrec) / m.caMoisPrec) * 100
    : m.caMois > 0
      ? 100
      : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="CA du mois"
          value={fmtMADCompact(m.caMois)}
          icon={TrendingUp}
          evolution={evo}
          comparaison="vs mois précédent"
        />
        <KpiCard
          label="CA de l'année"
          value={fmtMADCompact(m.caAnnee)}
          icon={Award}
          footer={
            <span className="text-muted-foreground">{fmtInt(m.nbVentes)} ventes au total</span>
          }
        />
        <KpiCard
          label="Panier moyen"
          value={fmtMADCompact(m.panier)}
          icon={ShoppingBag}
          footer={<span className="text-muted-foreground">par commande</span>}
        />
        <KpiCard
          label="Conversion des devis"
          value={`${m.conversion} %`}
          icon={FileCheck2}
          footer={<span className="text-muted-foreground">{m.devisEnCours} devis en cours</span>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard
          title="Objectif du mois"
          description={`Objectif : ${fmtMAD(user.objectifMensuel)}`}
        >
          <Gauge value={m.taux} />
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted p-2.5">
              <dt className="text-muted-foreground">Réalisé</dt>
              <dd className="text-sm font-semibold tabular">{fmtMADCompact(m.caMois)}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2.5">
              <dt className="text-muted-foreground">Reste à réaliser</dt>
              <dd className="text-sm font-semibold tabular">{fmtMADCompact(restant)}</dd>
            </div>
            <div className="col-span-2 rounded-lg bg-accent/60 p-2.5">
              <dt className="text-muted-foreground">Projection fin de mois (rythme actuel)</dt>
              <dd
                className={cn(
                  "text-sm font-semibold tabular",
                  projection >= user.objectifMensuel ? "text-success" : "text-foreground",
                )}
              >
                {fmtMADCompact(projection)}{" "}
                {user.objectifMensuel
                  ? `· ${Math.round((projection / user.objectifMensuel) * 100)} %`
                  : ""}
              </dd>
            </div>
          </dl>
          {m.equipe > 1 && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Trophy className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {ordinal(m.rang)} sur {m.equipe}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mode === "self"
                    ? "Votre classement ce mois-ci dans l'équipe"
                    : "Classement du mois dans l'équipe"}
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Évolution sur 12 mois"
          description="Chiffre d'affaires TTC réalisé et objectif mensuel"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={m.parMois} margin={{ left: -6, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" {...axisProps} />
                <YAxis
                  {...axisProps}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  content={<ChartTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ca" name="Réalisé" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Line
                  dataKey="objectif"
                  name="Objectif"
                  stroke="var(--sand-foreground)"
                  strokeDasharray="5 4"
                  dot={false}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={mode === "self" ? "Mes meilleurs clients" : "Meilleurs clients"}
          bodyClassName="p-0"
        >
          {m.topClients.length ? (
            <ul className="divide-y">
              {m.topClients.map((t, i) => (
                <li key={t.id}>
                  <Link
                    to="/clients/$id"
                    params={{ id: t.id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 md:px-5"
                  >
                    <span className="w-4 text-xs font-semibold text-muted-foreground tabular">
                      {i + 1}
                    </span>
                    <UserAvatar nom={t.client?.nom ?? "?"} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.client?.nom ?? "Client supprimé"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.client?.ville} · {t.client?.type}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular">{fmtMADCompact(t.ca)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              Aucune vente enregistrée pour le moment.
            </p>
          )}
        </SectionCard>
        <SectionCard
          title={mode === "self" ? "Mes produits les plus vendus" : "Produits les plus vendus"}
          bodyClassName="p-0"
        >
          {m.topProduits.length ? (
            <ul className="divide-y">
              {m.topProduits.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <img
                    src={productImage(p.image)}
                    alt=""
                    className="size-9 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtInt(p.quantite)} cartons vendus
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular">{fmtMADCompact(p.ca)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              Aucune vente enregistrée pour le moment.
            </p>
          )}
        </SectionCard>
      </div>

      {mode === "admin" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard title={`Portefeuille clients (${m.clients.length})`} bodyClassName="p-0">
            <ul className="max-h-[360px] divide-y overflow-y-auto">
              {m.clients.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/clients/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 md:px-5"
                  >
                    <UserAvatar nom={c.nom} className="size-7" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nom}</p>
                      <p className="text-xs text-muted-foreground">{c.ville}</p>
                    </div>
                  </Link>
                </li>
              ))}
              {!m.clients.length && (
                <li className="p-5 text-sm text-muted-foreground">Aucun client affecté.</li>
              )}
            </ul>
          </SectionCard>
          <SectionCard
            title="Dernières commandes"
            bodyClassName="p-0"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/commandes">Tout voir</Link>
              </Button>
            }
          >
            <ul className="divide-y">
              {m.commandes.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/commandes/$id", params: { id: c.id } })}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/40 md:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.numero}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {data.clients.find((x) => x.id === c.clientId)?.nom} · {fmtDate(c.date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular">
                        {fmtMADCompact(totaux(c).ttc)}
                      </span>
                      <StatusBadge tone={COMMANDE_STATUTS[c.statut].tone}>
                        {COMMANDE_STATUTS[c.statut].label}
                      </StatusBadge>
                    </div>
                  </button>
                </li>
              ))}
              {!m.commandes.length && (
                <li className="p-5 text-sm text-muted-foreground">Aucune commande.</li>
              )}
            </ul>
          </SectionCard>
          <SectionCard
            title="Derniers devis"
            bodyClassName="p-0"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/devis">Tout voir</Link>
              </Button>
            }
          >
            <ul className="divide-y">
              {m.devis.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/devis/$id", params: { id: d.id } })}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/40 md:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.numero}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {data.clients.find((x) => x.id === d.clientId)?.nom} · {fmtDate(d.date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular">
                        {fmtMADCompact(totaux(d).ttc)}
                      </span>
                      <StatusBadge tone={DEVIS_STATUTS[d.statut].tone}>
                        {DEVIS_STATUTS[d.statut].label}
                      </StatusBadge>
                    </div>
                  </button>
                </li>
              ))}
              {!m.devis.length && (
                <li className="p-5 text-sm text-muted-foreground">Aucun devis.</li>
              )}
            </ul>
          </SectionCard>
        </div>
      )}

      {mode === "self" && (
        <div className="card-surface flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center md:p-5">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Target className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {restant > 0
                ? `Encore ${fmtMAD(restant)} pour atteindre votre objectif`
                : "Objectif du mois atteint, félicitations !"}
            </p>
            <p className="text-xs text-muted-foreground">
              Relancez vos devis en attente pour accélérer la conversion.
            </p>
          </div>
          <Button asChild>
            <Link to="/devis">Voir mes devis</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
