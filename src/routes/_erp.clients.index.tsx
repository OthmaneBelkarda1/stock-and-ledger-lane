import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Download,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
  Wallet,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientFormDialog } from "@/components/erp/client-form-dialog";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { DataTable, type Column } from "@/components/erp/data-table";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { SearchInput, matches } from "@/components/erp/search-input";
import { StatusBadge } from "@/components/erp/status-badge";
import { UserAvatar } from "@/components/erp/user-menu";
import { ca } from "@/lib/erp/analytics";
import { round2, soldeFacture } from "@/lib/erp/calc";
import { CLIENT_TYPES } from "@/lib/erp/constants";
import { exportXlsx } from "@/lib/erp/export";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Client } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/clients/")({
  validateSearch: (s: Record<string, unknown>): { q?: string; nouveau?: boolean } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    nouveau: s.nouveau === true || s.nouveau === "true" ? true : undefined,
  }),
  head: pageHead(
    "Clients",
    "Gestion de la relation client : coordonnées, historique d'achat, devis, commandes et factures.",
  ),
  component: ClientsPage,
});

const ALL = "__all";

interface Row {
  client: Client;
  ca: number;
  commandes: number;
  reste: number;
  dernier?: string;
  commercial: string;
}

function ClientsPage() {
  const { data, isAdmin, clients, commandes, factures } = useScoped();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const deleteClient = useErp((s) => s.deleteClient);
  const [q, setQ] = useState(search.q ?? "");
  const [type, setType] = useState(ALL);
  const [ville, setVille] = useState(ALL);
  const [commercial, setCommercial] = useState(ALL);
  const [edit, setEdit] = useState<{ open: boolean; client?: Client }>({ open: false });
  const [toDelete, setToDelete] = useState<Client>();

  useEffect(() => {
    if (search.nouveau) {
      setEdit({ open: true });
      navigate({ to: "/clients", search: { q: search.q }, replace: true });
    }
  }, [search.nouveau, search.q, navigate]);

  const all: Row[] = useMemo(
    () =>
      clients.map((c) => {
        const cmds = commandes.filter((x) => x.clientId === c.id && x.statut !== "annulee");
        const fs = factures.filter((f) => f.clientId === c.id);
        const dernier = cmds
          .map((x) => x.date)
          .sort()
          .at(-1);
        return {
          client: c,
          ca: ca(cmds),
          commandes: cmds.length,
          reste: round2(fs.reduce((s, f) => s + soldeFacture(data, f).reste, 0)),
          dernier,
          commercial: data.users.find((u) => u.id === c.commercialId)?.nom ?? "—",
        };
      }),
    [clients, commandes, factures, data],
  );

  const villes = [...new Set(clients.map((c) => c.ville))].sort((a, b) => a.localeCompare(b, "fr"));
  const commerciaux = data.users.filter((u) => u.role === "commercial");

  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          matches(
            q,
            r.client.nom,
            r.client.ville,
            r.client.telephone,
            r.client.email,
            r.client.ice,
          ) &&
          (type === ALL || r.client.type === type) &&
          (ville === ALL || r.client.ville === ville) &&
          (commercial === ALL || r.client.commercialId === commercial),
      ),
    [all, q, type, ville, commercial],
  );

  const totalCa = all.reduce((s, r) => s + r.ca, 0);
  const totalReste = all.reduce((s, r) => s + r.reste, 0);
  const actifs = all.filter(
    (r) => r.dernier && Date.now() - new Date(r.dernier).getTime() < 90 * 86400000,
  ).length;
  const nouveaux = clients.filter(
    (c) => Date.now() - new Date(c.dateCreation).getTime() < 30 * 86400000,
  ).length;

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Clients",
          rows: rows.map((r) => ({
            Client: r.client.nom,
            Type: r.client.type,
            Ville: r.client.ville,
            Téléphone: r.client.telephone,
            "E-mail": r.client.email,
            ICE: r.client.ice ?? "",
            Commercial: r.commercial,
            "CA TTC (DH)": r.ca,
            Commandes: r.commandes,
            "Reste à payer (DH)": r.reste,
          })),
        },
      ],
      "clients.xlsx",
    ).then(() => toast.success("Export Excel généré."));

  const actions = (c: Client) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => navigate({ to: "/clients/$id", params: { id: c.id } })}>
          <Eye /> Ouvrir la fiche
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setEdit({ open: true, client: c })}>
          <Pencil /> Modifier
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setToDelete(c)}
        >
          <Trash2 /> Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: Column<Row>[] = [
    {
      id: "nom",
      header: "Client",
      sort: (r) => r.client.nom,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <UserAvatar nom={r.client.nom} className="size-9" />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.client.nom}</p>
            <p className="truncate text-xs text-muted-foreground">{r.client.telephone}</p>
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sort: (r) => r.client.type,
      cell: (r) => (
        <StatusBadge tone="sand" withDot={false}>
          {r.client.type}
        </StatusBadge>
      ),
      hideBelow: "lg",
    },
    { id: "ville", header: "Ville", sort: (r) => r.client.ville, cell: (r) => r.client.ville },
    ...(isAdmin
      ? [
          {
            id: "com",
            header: "Commercial",
            sort: (r: Row) => r.commercial,
            cell: (r: Row) => r.commercial,
            hideBelow: "xl" as const,
          },
        ]
      : []),
    { id: "ca", header: "CA TTC", align: "right", sort: (r) => r.ca, cell: (r) => fmtMAD(r.ca) },
    {
      id: "cmd",
      header: "Cmd.",
      align: "right",
      sort: (r) => r.commandes,
      cell: (r) => fmtInt(r.commandes),
      hideBelow: "lg",
    },
    {
      id: "reste",
      header: "Reste à payer",
      align: "right",
      sort: (r) => r.reste,
      cell: (r) => (
        <span className={r.reste > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
          {fmtMAD(r.reste)}
        </span>
      ),
    },
    {
      id: "der",
      header: "Dernier achat",
      sort: (r) => r.dernier ?? "",
      cell: (r) => fmtDate(r.dernier),
      hideBelow: "xl",
    },
    { id: "a", header: "", align: "right", cell: (r) => actions(r.client) },
  ];

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Clients" : "Mes clients"}
        description={
          isAdmin
            ? "Portefeuille clients, historique d'achat et encours."
            : "Votre portefeuille clients et leur historique d'achat."
        }
        actions={
          <>
            <Button variant="outline" onClick={exporter}>
              <Download /> Exporter
            </Button>
            <Button onClick={() => setEdit({ open: true })}>
              <Plus /> Nouveau client
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="Clients"
          value={fmtInt(clients.length)}
          icon={Users}
          footer={<span className="text-primary-foreground/70">{actifs} actifs sur 90 jours</span>}
        />
        <KpiCard
          label="Chiffre d'affaires cumulé"
          value={fmtMADCompact(totalCa)}
          icon={TrendingUp}
          footer={<span className="text-muted-foreground">toutes périodes</span>}
        />
        <KpiCard
          label="Encours clients"
          value={fmtMADCompact(totalReste)}
          icon={Wallet}
          footer={<span className="text-muted-foreground">reste à encaisser</span>}
        />
        <KpiCard
          label="Nouveaux clients"
          value={fmtInt(nouveaux)}
          icon={UserPlus}
          footer={<span className="text-muted-foreground">sur 30 jours</span>}
        />
      </div>

      <div className="card-surface mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Nom, ville, téléphone, ICE…"
          className="lg:w-72"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-1">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-10 bg-card lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les types</SelectItem>
              {CLIENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ville} onValueChange={setVille}>
            <SelectTrigger className="h-10 bg-card lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les villes</SelectItem>
              {villes.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={commercial} onValueChange={setCommercial}>
              <SelectTrigger className="col-span-2 h-10 bg-card sm:col-span-1 lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les commerciaux</SelectItem>
                {commerciaux.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="text-xs text-muted-foreground lg:ml-auto">
          {rows.length} client{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="card-surface overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.client.id}
          onRowClick={(r) => navigate({ to: "/clients/$id", params: { id: r.client.id } })}
          initialSort={{ id: "ca", dir: "desc" }}
          pageSize={12}
          emptyTitle="Aucun client trouvé"
          mobileCard={(r) => (
            <div className="flex items-start gap-3">
              <UserAvatar nom={r.client.nom} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.client.nom}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {r.client.ville} · {r.client.type}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="size-3" /> {r.client.telephone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular">{fmtMADCompact(r.ca)}</p>
                {r.reste > 0 && (
                  <p className="text-[11px] text-destructive tabular">
                    {fmtMADCompact(r.reste)} dû
                  </p>
                )}
              </div>
            </div>
          )}
        />
      </div>

      <ClientFormDialog
        open={edit.open}
        client={edit.client}
        onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))}
        onSaved={(id) => {
          if (!edit.client) navigate({ to: "/clients/$id", params: { id } });
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title="Supprimer ce client ?"
        description={`« ${toDelete?.nom ?? ""} » et ses devis seront supprimés. Un client ayant des commandes ou des factures ne peut pas être supprimé.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          const r = tryAction(() => deleteClient(toDelete.id));
          if (r.ok) toast.success("Client supprimé.");
          else toast.error(r.error);
        }}
      />
    </div>
  );
}
