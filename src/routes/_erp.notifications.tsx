import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BellOff,
  CheckCheck,
  Clock,
  FileWarning,
  PackageX,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/erp/empty-state";
import { NotifIcon } from "@/components/erp/notif-icon";
import { PageHeader } from "@/components/erp/page-header";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { soldeFacture, stockDisponible } from "@/lib/erp/calc";
import { NIVEAUX_NOTIF } from "@/lib/erp/constants";
import { fmtDate, fmtDateTime, fmtMAD, timeAgo } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useNotifications, useScoped } from "@/lib/erp/hooks";
import { useErp } from "@/lib/erp/store";
import type { NiveauNotif, Notification } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_erp/notifications")({
  head: pageHead(
    "Notifications",
    "Centre de notifications : commandes, devis, stocks, paiements et factures impayées.",
  ),
  component: NotificationsPage,
});

type Categorie = "commandes" | "devis" | "stocks" | "paiements" | "impayes" | "autres";
const CATEGORIES: Record<Categorie, string> = {
  commandes: "Commandes",
  devis: "Devis",
  stocks: "Stocks",
  paiements: "Paiements",
  impayes: "Factures impayées",
  autres: "Clients & équipe",
};

const categorieDe = (n: Notification): Categorie => {
  const t = n.titre.toLowerCase();
  const l = n.lien ?? "";
  if (t.includes("impay") || (l.startsWith("/factures") && n.niveau === "alerte")) return "impayes";
  if (t.includes("paiement") || l.startsWith("/paiements")) return "paiements";
  if (l.startsWith("/stocks") || t.includes("stock") || t.includes("rupture")) return "stocks";
  if (l.startsWith("/devis") || t.includes("devis")) return "devis";
  if (l.startsWith("/commandes") || t.includes("commande")) return "commandes";
  if (l.startsWith("/factures")) return "paiements";
  return "autres";
};

const ALL = "__all";

function NotificationsPage() {
  const { list, unread } = useNotifications();
  const { data, devis, factures } = useScoped();
  const markRead = useErp((s) => s.markRead);
  const markAllRead = useErp((s) => s.markAllRead);
  const deleteNotification = useErp((s) => s.deleteNotification);
  const navigate = useNavigate();
  const [cat, setCat] = useState<string>(ALL);
  const [niveau, setNiveau] = useState<string>(ALL);
  const [lecture, setLecture] = useState<string>(ALL);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of list) c[categorieDe(n)] = (c[categorieDe(n)] ?? 0) + 1;
    return c;
  }, [list]);

  const rows = list
    .filter(
      (n) =>
        (cat === ALL || categorieDe(n) === cat) &&
        (niveau === ALL || n.niveau === niveau) &&
        (lecture === ALL || (lecture === "non_lu" ? !n.lu : n.lu)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const aTraiter = useMemo(() => {
    const now = Date.now();
    const in7 = now + 7 * 86400000;
    const retards = factures
      .map((f) => ({ f, ...soldeFacture(data, f) }))
      .filter((x) => x.reste > 0.009 && new Date(x.f.echeance).getTime() < now)
      .sort((a, b) => a.f.echeance.localeCompare(b.f.echeance));
    const expirent = devis
      .filter((d) => d.statut === "envoye" && !d.commandeId)
      .filter((d) => {
        const t = new Date(d.validite).getTime();
        return t >= now - 86400000 && t <= in7;
      })
      .sort((a, b) => a.validite.localeCompare(b.validite));
    const stocks = data.products
      .map((p) => ({ p, dispo: stockDisponible(data, p.id) }))
      .filter((x) => x.dispo <= x.p.seuilMin)
      .sort((a, b) => a.dispo - b.dispo);
    return { retards, expirent, stocks };
  }, [data, devis, factures]);

  const clientNom = (id: string) => data.clients.find((c) => c.id === id)?.nom ?? "—";

  const open = (n: Notification) => {
    if (!n.lu) markRead(n.id);
    if (n.lien) navigate({ to: n.lien });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} notification(s) non lue(s)` : "Vous êtes à jour."}
        actions={
          <Button
            variant="outline"
            disabled={!unread}
            onClick={() => {
              markAllRead(list.filter((n) => !n.lu).map((n) => n.id));
              toast.success("Toutes les notifications sont marquées comme lues.");
            }}
          >
            <CheckCheck /> Tout marquer comme lu
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <ATraiter
          icon={FileWarning}
          tone="danger"
          titre="Factures en retard"
          count={aTraiter.retards.length}
          vide="Aucune facture en retard."
        >
          {aTraiter.retards.slice(0, 4).map((x) => (
            <Link
              key={x.f.id}
              to="/factures/$id"
              params={{ id: x.f.id }}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
            >
              <span className="min-w-0 truncate">
                <b className="font-medium tabular">{x.f.numero}</b>{" "}
                <span className="text-muted-foreground">· {clientNom(x.f.clientId)}</span>
              </span>
              <span className="shrink-0 font-medium tabular text-destructive">
                {fmtMAD(x.reste)}
              </span>
            </Link>
          ))}
        </ATraiter>
        <ATraiter
          icon={Clock}
          tone="warning"
          titre="Devis expirant sous 7 jours"
          count={aTraiter.expirent.length}
          vide="Aucun devis n'arrive à expiration."
        >
          {aTraiter.expirent.slice(0, 4).map((d) => (
            <Link
              key={d.id}
              to="/devis/$id"
              params={{ id: d.id }}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
            >
              <span className="min-w-0 truncate">
                <b className="font-medium tabular">{d.numero}</b>{" "}
                <span className="text-muted-foreground">· {clientNom(d.clientId)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(d.validite)}</span>
            </Link>
          ))}
        </ATraiter>
        <ATraiter
          icon={PackageX}
          tone="warning"
          titre="Produits sous le seuil"
          count={aTraiter.stocks.length}
          vide="Aucun produit sous le seuil."
        >
          {aTraiter.stocks.slice(0, 4).map((x) => (
            <Link
              key={x.p.id}
              to="/stocks"
              search={{ onglet: "alertes" }}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
            >
              <span className="min-w-0 truncate">{x.p.nom}</span>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium tabular",
                  x.dispo <= 0 ? "text-destructive" : "text-warning-foreground",
                )}
              >
                {x.dispo} ct
              </span>
            </Link>
          ))}
        </ATraiter>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={cat === ALL}
          onClick={() => setCat(ALL)}
          label="Toutes"
          count={list.length}
        />
        {(Object.keys(CATEGORIES) as Categorie[]).map((c) => (
          <FilterChip
            key={c}
            active={cat === c}
            onClick={() => setCat(c)}
            label={CATEGORIES[c]}
            count={counts[c] ?? 0}
          />
        ))}
      </div>

      <SectionCard
        title="Historique"
        description={`${rows.length} notification(s)`}
        bodyClassName="p-0"
        action={
          <div className="flex gap-2">
            <Select value={niveau} onValueChange={setNiveau}>
              <SelectTrigger className="h-8 w-[130px] bg-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous niveaux</SelectItem>
                {(Object.keys(NIVEAUX_NOTIF) as NiveauNotif[]).map((n) => (
                  <SelectItem key={n} value={n}>
                    {NIVEAUX_NOTIF[n].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lecture} onValueChange={setLecture}>
              <SelectTrigger className="h-8 w-[110px] bg-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes</SelectItem>
                <SelectItem value="non_lu">Non lues</SelectItem>
                <SelectItem value="lu">Lues</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Aucune notification"
            description="Aucune notification ne correspond à ces filtres."
          />
        ) : (
          <ul className="divide-y">
            {rows.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "group flex items-start gap-3 px-4 py-3.5 transition-colors md:px-5",
                  !n.lu && "bg-primary-soft/40",
                )}
              >
                <NotifIcon niveau={n.niveau} className="mt-0.5" />
                <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm", !n.lu ? "font-semibold" : "font-medium")}>
                      {n.titre}
                    </p>
                    <StatusBadge tone="neutral" withDot={false} className="text-[10px]">
                      {CATEGORIES[categorieDe(n)]}
                    </StatusBadge>
                    {!n.lu && (
                      <span className="size-2 rounded-full bg-primary" aria-label="Non lue" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground" title={fmtDateTime(n.date)}>
                    {timeAgo(n.date)}
                  </p>
                </button>
                <div className="flex shrink-0 gap-1">
                  {!n.lu && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Marquer comme lue"
                      title="Marquer comme lue"
                      onClick={() => markRead(n.id)}
                    >
                      <CheckCheck />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label="Supprimer"
                    title="Supprimer"
                    onClick={() => {
                      deleteNotification(n.id);
                      toast.success("Notification supprimée.");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 tabular",
          active ? "bg-primary-foreground/15" : "bg-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ATraiter({
  icon: Icon,
  tone,
  titre,
  count,
  vide,
  children,
}: {
  icon: typeof AlertTriangle;
  tone: "danger" | "warning";
  titre: string;
  count: number;
  vide: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface fade-up p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-destructive-soft text-destructive"
              : "bg-warning-soft text-warning-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
        <p className="flex-1 text-sm font-semibold">{titre}</p>
        <StatusBadge tone={count ? tone : "success"}>{count}</StatusBadge>
      </div>
      {count ? (
        <div className="space-y-0.5">{children}</div>
      ) : (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">{vide}</p>
      )}
    </section>
  );
}
