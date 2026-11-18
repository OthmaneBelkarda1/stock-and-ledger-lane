import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Boxes,
  CreditCard,
  Download,
  FileText,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
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
import { PageHeader } from "@/components/erp/page-header";
import { SearchInput, matches } from "@/components/erp/search-input";
import { UserAvatar } from "@/components/erp/user-menu";
import { exportXlsx } from "@/lib/erp/export";
import { fmtDateTime, fmtLongDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useCurrentUser, useData } from "@/lib/erp/hooks";
import type { Activite } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/activites")({
  head: pageHead("Activités", "Journal des actions effectuées dans l'application."),
  component: ActivitesPage,
});

const ALL = "__all";
const ICONS: Record<string, LucideIcon> = {
  Produit: Package,
  Stock: Boxes,
  Dépôt: Warehouse,
  Client: Users,
  Fournisseur: Truck,
  Utilisateur: UserCog,
  Devis: FileText,
  Commande: ShoppingCart,
  Facture: Receipt,
  Paiement: CreditCard,
  Paramètres: Settings,
};
const PERIODES: Record<string, { label: string; jours: number }> = {
  tout: { label: "Tout l'historique", jours: 0 },
  jour: { label: "Aujourd'hui", jours: 1 },
  semaine: { label: "7 derniers jours", jours: 7 },
  mois: { label: "30 derniers jours", jours: 30 },
  trimestre: { label: "90 derniers jours", jours: 90 },
};

function ActivitesPage() {
  const data = useData();
  const user = useCurrentUser();
  const isAdmin = user.role === "admin";
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [periode, setPeriode] = useState("tout");
  const [limite, setLimite] = useState(60);

  const base = useMemo(
    () => (isAdmin ? data.activites : data.activites.filter((a) => a.userId === user.id)),
    [data.activites, isAdmin, user.id],
  );
  const actions = useMemo(() => [...new Set(base.map((a) => a.action))].sort(), [base]);
  const userNom = (id: string) => data.users.find((u) => u.id === id)?.nom ?? "Utilisateur";

  const rows = useMemo(() => {
    const jours = PERIODES[periode]?.jours ?? 0;
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    if (jours > 1) debut.setDate(debut.getDate() - (jours - 1));
    return base
      .filter(
        (a) =>
          (userId === ALL || a.userId === userId) &&
          (action === ALL || a.action === action) &&
          (!jours || new Date(a.date) >= debut) &&
          matches(q, a.description, a.action),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [base, userId, action, periode, q]);

  const groupes = useMemo(() => {
    const map = new Map<string, Activite[]>();
    for (const a of rows.slice(0, limite)) {
      const key = new Date(a.date).toDateString();
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }, [rows, limite]);

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Journal d'activité",
          rows: rows.map((a) => ({
            Date: fmtDateTime(a.date),
            Utilisateur: userNom(a.userId),
            Module: a.action,
            Description: a.description,
          })),
        },
      ],
      "journal-activite.xlsx",
    ).then(() => toast.success("Export Excel généré."));

  const jourLabel = (key: string) => {
    const d = new Date(key);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Hier";
    const s = fmtLongDate(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={isAdmin ? "Journal d'activité" : "Mon historique d'activité"}
        description={
          isAdmin
            ? "Traçabilité de toutes les actions effectuées par l'équipe."
            : "Toutes les actions que vous avez effectuées."
        }
        actions={
          <Button variant="outline" onClick={exporter} disabled={!rows.length}>
            <Download /> Export Excel
          </Button>
        }
      />

      <div className="card-surface grid grid-cols-2 gap-2 p-3 lg:flex lg:items-center">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher une action…"
          className="col-span-2 lg:w-72"
        />
        {isAdmin && (
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-10 bg-card lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les utilisateurs</SelectItem>
              {data.users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-10 bg-card lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les modules</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periode} onValueChange={setPeriode}>
          <SelectTrigger className="h-10 bg-card lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIODES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="col-span-2 text-xs text-muted-foreground lg:ml-auto">
          {rows.length} action(s)
        </p>
      </div>

      {groupes.length === 0 ? (
        <div className="card-surface">
          <EmptyState
            icon={Activity}
            title="Aucune activité"
            description="Aucune action ne correspond à ces filtres."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groupes.map(([jour, items]) => (
            <section key={jour} className="fade-up">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {jourLabel(jour)}
              </h2>
              <ol className="card-surface divide-y">
                {items.map((a) => {
                  const Icon = ICONS[a.action] ?? Activity;
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{a.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.action} ·{" "}
                          {new Date(a.date).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="hidden shrink-0 items-center gap-2 sm:flex">
                          <UserAvatar nom={userNom(a.userId)} className="size-6" />
                          <span className="text-xs text-muted-foreground">{userNom(a.userId)}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {rows.length > limite && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimite((l) => l + 60)}>
                Afficher plus ({rows.length - limite} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
