import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Power,
  Target,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { ChartTooltip, axisProps } from "@/components/erp/chart-tooltip";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { SearchInput, matches } from "@/components/erp/search-input";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { UserAvatar } from "@/components/erp/user-menu";
import { UserFormDialog } from "@/components/erp/user-form-dialog";
import { ca, ventesDans } from "@/lib/erp/analytics";
import { plagePeriode } from "@/lib/erp/calc";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useData } from "@/lib/erp/hooks";
import { ROLE_LABELS } from "@/lib/erp/permissions";
import { tryAction, useErp } from "@/lib/erp/store";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/commerciaux/")({
  head: pageHead(
    "Commerciaux",
    "Équipe commerciale : profils, objectifs, ventes, performances et comparaisons.",
  ),
  component: CommerciauxPage,
});

function CommerciauxPage() {
  const data = useData();
  const navigate = useNavigate();
  const toggleUser = useErp((s) => s.toggleUser);
  const [edit, setEdit] = useState<{ open: boolean; user?: User }>({ open: false });
  const [assign, setAssign] = useState<User>();

  const stats = useMemo(() => {
    const mois = plagePeriode("mois");
    const annee = plagePeriode("annee");
    return data.users
      .filter((u) => u.role === "commercial")
      .map((u) => {
        const cmds = data.commandes.filter((c) => c.commercialId === u.id);
        const cmdMois = ventesDans(cmds, mois);
        const caMois = ca(cmdMois);
        const devis = data.devis.filter((d) => d.commercialId === u.id);
        const tranches = devis.filter(
          (d) => d.statut === "accepte" || d.statut === "refuse" || d.statut === "expire",
        );
        const acceptes = devis.filter((d) => d.statut === "accepte").length;
        return {
          u,
          caMois,
          caAnnee: ca(ventesDans(cmds, annee)),
          cmdMois: cmdMois.length,
          clients: data.clients.filter((c) => c.commercialId === u.id).length,
          taux: u.objectifMensuel ? Math.round((caMois / u.objectifMensuel) * 100) : 0,
          conversion: tranches.length ? Math.round((acceptes / tranches.length) * 100) : 0,
        };
      })
      .sort((a, b) => Number(b.u.actif) - Number(a.u.actif) || b.caMois - a.caMois);
  }, [data]);

  const actifs = stats.filter((s) => s.u.actif);
  const totalMois = actifs.reduce((s, x) => s + x.caMois, 0);
  const totalObj = actifs.reduce((s, x) => s + x.u.objectifMensuel, 0);
  const meilleur = [...actifs].sort((a, b) => b.taux - a.taux)[0];
  const chart = actifs.map((s) => ({
    nom: s.u.nom.split(" ")[0],
    ca: s.caMois,
    objectif: s.u.objectifMensuel,
  }));
  const admins = data.users.filter((u) => u.role === "admin");

  const toggle = (u: User) => {
    const r = tryAction(() => toggleUser(u.id));
    if (r.ok)
      toast.success(
        u.actif
          ? `Le compte de ${u.nom} a été désactivé.`
          : `Le compte de ${u.nom} a été réactivé.`,
      );
    else toast.error(r.error);
  };

  return (
    <div>
      <PageHeader
        title="Équipe commerciale"
        description="Objectifs, ventes du mois, taux de réalisation et comparaisons."
        actions={
          <Button onClick={() => setEdit({ open: true })}>
            <Plus /> Nouveau collaborateur
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="CA de l'équipe — ce mois"
          value={fmtMADCompact(totalMois)}
          icon={TrendingUp}
          footer={
            <span className="text-primary-foreground/70">objectif {fmtMADCompact(totalObj)}</span>
          }
        />
        <KpiCard
          label="Réalisation globale"
          value={`${totalObj ? Math.round((totalMois / totalObj) * 100) : 0} %`}
          icon={Target}
          footer={<span className="text-muted-foreground">de l'objectif cumulé</span>}
        />
        <KpiCard
          label="Commerciaux actifs"
          value={fmtInt(actifs.length)}
          icon={Users}
          footer={
            <span className="text-muted-foreground">{stats.length - actifs.length} inactif(s)</span>
          }
        />
        <KpiCard
          label="Meilleure réalisation"
          value={meilleur ? meilleur.u.nom.split(" ")[0] : "—"}
          icon={Award}
          footer={
            <span className="text-success">
              {meilleur ? `${meilleur.taux} % de l'objectif` : ""}
            </span>
          }
        />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard
          title="Chiffre d'affaires vs objectif"
          description="Mois en cours, par commercial (TTC)"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -6, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nom" {...axisProps} />
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
                <Bar dataKey="objectif" name="Objectif" fill="var(--sand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Classement du mois" bodyClassName="p-0">
          <ol className="divide-y">
            {[...actifs]
              .sort((a, b) => b.caMois - a.caMois)
              .map((s, i) => (
                <li key={s.u.id}>
                  <Link
                    to="/commerciaux/$id"
                    params={{ id: s.u.id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 md:px-5"
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                        i === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <UserAvatar nom={s.u.nom} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.u.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.cmdMois} commandes · {s.conversion} % conversion
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular">{fmtMADCompact(s.caMois)}</span>
                  </Link>
                </li>
              ))}
          </ol>
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <article
            key={s.u.id}
            className={cn(
              "card-surface fade-up flex flex-col p-4 md:p-5",
              !s.u.actif && "opacity-70",
            )}
          >
            <div className="flex items-start gap-3">
              <UserAvatar nom={s.u.nom} avatar={s.u.avatar} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.u.nom}</p>
                <p className="text-xs text-muted-foreground">
                  Depuis le {fmtDate(s.u.dateRecrutement)}
                </p>
                <div className="mt-1">
                  {s.u.actif ? (
                    <StatusBadge tone="success">Actif</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Inactif</StatusBadge>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => navigate({ to: "/commerciaux/$id", params: { id: s.u.id } })}
                  >
                    <UserCog /> Voir le profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEdit({ open: true, user: s.u })}>
                    <Pencil /> Modifier le compte
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAssign(s.u)}>
                    <Users /> Affecter des clients
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => toggle(s.u)}
                    className={s.u.actif ? "text-destructive focus:text-destructive" : undefined}
                  >
                    <Power /> {s.u.actif ? "Désactiver" : "Réactiver"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-2 truncate">
                <Mail className="size-3.5" /> {s.u.email}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-3.5" /> {s.u.telephone}
              </p>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-semibold tabular">{fmtMAD(s.caMois)}</span>
                <span
                  className={cn(
                    "text-xs font-medium tabular",
                    s.taux >= 100
                      ? "text-success"
                      : s.taux >= 60
                        ? "text-foreground"
                        : "text-warning-foreground",
                  )}
                >
                  {s.taux} %
                </span>
              </div>
              <Progress value={Math.min(100, s.taux)} className="h-2" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Objectif mensuel : {fmtMAD(s.u.objectifMensuel)}
              </p>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted p-2">
                <dd className="text-sm font-semibold tabular">{s.cmdMois}</dd>
                <dt className="text-muted-foreground">cmd. du mois</dt>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <dd className="text-sm font-semibold tabular">{s.clients}</dd>
                <dt className="text-muted-foreground">clients</dt>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <dd className="text-sm font-semibold tabular">{fmtMADCompact(s.caAnnee)}</dd>
                <dt className="text-muted-foreground">CA annuel</dt>
              </div>
            </dl>
            <Button asChild variant="ghost" size="sm" className="mt-3 self-end">
              <Link to="/commerciaux/$id" params={{ id: s.u.id }}>
                Performances détaillées <ArrowRight />
              </Link>
            </Button>
          </article>
        ))}
      </div>

      {admins.length > 0 && (
        <SectionCard title="Administrateurs" className="mt-5" bodyClassName="p-0">
          <ul className="divide-y">
            {admins.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <UserAvatar nom={u.nom} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.nom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email} · {ROLE_LABELS[u.role]}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEdit({ open: true, user: u })}>
                  <Pencil /> Modifier
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <UserFormDialog
        open={edit.open}
        user={edit.user}
        onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))}
      />
      <AssignDialog user={assign} onClose={() => setAssign(undefined)} />
    </div>
  );
}

function AssignDialog({ user, onClose }: { user?: User; onClose: () => void }) {
  const data = useData();
  const assignClients = useErp((s) => s.assignClients);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const list = data.clients.filter(
    (c) => c.commercialId !== user?.id && matches(q, c.nom, c.ville),
  );
  const nom = (id: string) => data.users.find((u) => u.id === id)?.nom ?? "—";

  const close = () => {
    setSel([]);
    setQ("");
    onClose();
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Affecter des clients</DialogTitle>
          <DialogDescription>
            Sélectionnez les clients à transférer à {user?.nom}.
          </DialogDescription>
        </DialogHeader>
        <SearchInput value={q} onChange={setQ} placeholder="Rechercher un client…" />
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {list.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent/40">
                <Checkbox
                  checked={sel.includes(c.id)}
                  onCheckedChange={(v) =>
                    setSel((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.ville} · actuellement : {nom(c.commercialId)}
                  </p>
                </div>
              </label>
            </li>
          ))}
          {!list.length && (
            <li className="p-4 text-center text-sm text-muted-foreground">
              Aucun client à affecter.
            </li>
          )}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button
            disabled={!sel.length}
            onClick={() => {
              if (!user) return;
              assignClients(user.id, sel);
              toast.success(`${sel.length} client(s) affecté(s) à ${user.nom}.`);
              close();
            }}
          >
            Affecter {sel.length ? `(${sel.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
