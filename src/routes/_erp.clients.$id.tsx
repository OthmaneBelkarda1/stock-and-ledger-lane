import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShoppingCart,
  Trash2,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartTooltip, axisProps } from "@/components/erp/chart-tooltip";
import { ClientFormDialog } from "@/components/erp/client-form-dialog";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { DataTable, type Column } from "@/components/erp/data-table";
import { EmptyState } from "@/components/erp/empty-state";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { UserAvatar } from "@/components/erp/user-menu";
import { ca, caParMois } from "@/lib/erp/analytics";
import { round2, soldeFacture, statutFacture, totaux } from "@/lib/erp/calc";
import {
  COMMANDE_STATUTS,
  DEVIS_STATUTS,
  FACTURE_STATUTS,
  MODES_PAIEMENT,
} from "@/lib/erp/constants";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Commande, Devis, Facture, Paiement } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/clients/$id")({
  head: pageHead(
    "Fiche client",
    "Coordonnées, historique d'achat, devis, commandes, factures et paiements du client.",
  ),
  component: ClientPage,
});

function ClientPage() {
  const { id } = Route.useParams();
  const { data, isAdmin, clients } = useScoped();
  const navigate = useNavigate();
  const deleteClient = useErp((s) => s.deleteClient);
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const client = clients.find((c) => c.id === id);

  const h = useMemo(() => {
    const devis = data.devis
      .filter((d) => d.clientId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const commandes = data.commandes
      .filter((c) => c.clientId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const factures = data.factures
      .filter((f) => f.clientId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const paiements = data.paiements
      .filter((p) => p.clientId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const actives = commandes.filter((c) => c.statut !== "annulee");
    return {
      devis,
      commandes,
      factures,
      paiements,
      ca: ca(commandes),
      reste: round2(factures.reduce((s, f) => s + soldeFacture(data, f).reste, 0)),
      paye: round2(paiements.reduce((s, p) => s + p.montant, 0)),
      dernier: actives[0]?.date,
      parMois: caParMois(commandes, new Date(), 12),
      nbActives: actives.length,
    };
  }, [data, id]);

  if (!client) {
    return (
      <div className="card-surface mx-auto mt-6 max-w-lg">
        <EmptyState
          icon={UserRound}
          title="Client introuvable"
          description="Ce client n'existe pas ou ne fait pas partie de votre portefeuille."
          action={
            <Button asChild>
              <Link to="/clients">
                <ArrowLeft /> Retour aux clients
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const commercial = data.users.find((u) => u.id === client.commercialId);
  const panier = h.nbActives ? h.ca / h.nbActives : 0;

  const devisCols: Column<Devis>[] = [
    {
      id: "num",
      header: "Numéro",
      sort: (d) => d.numero,
      cell: (d) => <span className="font-medium">{d.numero}</span>,
    },
    { id: "date", header: "Date", sort: (d) => d.date, cell: (d) => fmtDate(d.date) },
    { id: "val", header: "Validité", cell: (d) => fmtDate(d.validite), hideBelow: "lg" },
    {
      id: "ttc",
      header: "Montant TTC",
      align: "right",
      sort: (d) => totaux(d).ttc,
      cell: (d) => fmtMAD(totaux(d).ttc),
    },
    {
      id: "st",
      header: "Statut",
      cell: (d) => (
        <StatusBadge tone={DEVIS_STATUTS[d.statut].tone}>
          {DEVIS_STATUTS[d.statut].label}
        </StatusBadge>
      ),
    },
  ];
  const cmdCols: Column<Commande>[] = [
    {
      id: "num",
      header: "Numéro",
      sort: (c) => c.numero,
      cell: (c) => <span className="font-medium">{c.numero}</span>,
    },
    { id: "date", header: "Date", sort: (c) => c.date, cell: (c) => fmtDate(c.date) },
    { id: "liv", header: "Livraison", cell: (c) => fmtDate(c.dateLivraison), hideBelow: "lg" },
    {
      id: "ttc",
      header: "Montant TTC",
      align: "right",
      sort: (c) => totaux(c).ttc,
      cell: (c) => fmtMAD(totaux(c).ttc),
    },
    {
      id: "st",
      header: "Statut",
      cell: (c) => (
        <StatusBadge tone={COMMANDE_STATUTS[c.statut].tone}>
          {COMMANDE_STATUTS[c.statut].label}
        </StatusBadge>
      ),
    },
  ];
  const facCols: Column<Facture>[] = [
    {
      id: "num",
      header: "Numéro",
      sort: (f) => f.numero,
      cell: (f) => <span className="font-medium">{f.numero}</span>,
    },
    { id: "date", header: "Date", sort: (f) => f.date, cell: (f) => fmtDate(f.date) },
    { id: "ech", header: "Échéance", cell: (f) => fmtDate(f.echeance), hideBelow: "lg" },
    {
      id: "ttc",
      header: "TTC",
      align: "right",
      sort: (f) => totaux(f).ttc,
      cell: (f) => fmtMAD(totaux(f).ttc),
    },
    {
      id: "reste",
      header: "Reste",
      align: "right",
      cell: (f) => fmtMAD(soldeFacture(data, f).reste),
    },
    {
      id: "st",
      header: "Statut",
      cell: (f) => {
        const s = FACTURE_STATUTS[statutFacture(data, f)];
        return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
      },
    },
  ];
  const payCols: Column<Paiement>[] = [
    {
      id: "num",
      header: "Référence",
      cell: (p) => <span className="font-medium">{p.numero}</span>,
    },
    { id: "date", header: "Date", sort: (p) => p.date, cell: (p) => fmtDate(p.date) },
    {
      id: "fac",
      header: "Facture",
      cell: (p) => data.factures.find((f) => f.id === p.factureId)?.numero ?? "—",
    },
    { id: "mode", header: "Mode", cell: (p) => MODES_PAIEMENT[p.mode], hideBelow: "lg" },
    {
      id: "mt",
      header: "Montant",
      align: "right",
      sort: (p) => p.montant,
      cell: (p) => <span className="font-medium text-success">{fmtMAD(p.montant)}</span>,
    },
  ];

  const mobileDoc = (numero: string, date: string, montant: number, badge: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{numero}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(date)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular">{fmtMAD(montant)}</span>
        {badge}
      </div>
    </div>
  );

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
        <Link to="/clients">
          <ArrowLeft /> {isAdmin ? "Clients" : "Mes clients"}
        </Link>
      </Button>
      <PageHeader
        eyebrow={client.type}
        title={client.nom}
        description={`Client depuis le ${fmtDate(client.dateCreation)} · ${client.ville}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil /> Modifier
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmDel(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 /> Supprimer
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/devis/nouveau", search: { client: client.id } })}
            >
              <FileText /> Nouveau devis
            </Button>
            <Button
              onClick={() => navigate({ to: "/commandes/nouvelle", search: { client: client.id } })}
            >
              <ShoppingCart /> Nouvelle commande
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="Chiffre d'affaires"
          value={fmtMADCompact(h.ca)}
          icon={TrendingUp}
          footer={
            <span className="text-primary-foreground/70">panier moyen {fmtMADCompact(panier)}</span>
          }
        />
        <KpiCard
          label="Commandes"
          value={fmtInt(h.nbActives)}
          icon={ShoppingCart}
          footer={<span className="text-muted-foreground">{h.devis.length} devis émis</span>}
        />
        <KpiCard
          label="Reste à payer"
          value={fmtMADCompact(h.reste)}
          icon={Wallet}
          footer={
            <span className={h.reste > 0 ? "text-destructive" : "text-success"}>
              {h.reste > 0 ? "encours à recouvrer" : "aucun impayé"}
            </span>
          }
        />
        <KpiCard
          label="Dernier achat"
          value={fmtDate(h.dernier)}
          icon={CalendarDays}
          footer={<span className="text-muted-foreground">{fmtMADCompact(h.paye)} encaissés</span>}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title="Coordonnées">
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Téléphone</dt>
                <dd>
                  <a
                    href={`tel:${client.telephone.replace(/\s/g, "")}`}
                    className="hover:underline"
                  >
                    {client.telephone}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">E-mail</dt>
                <dd className="truncate">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Adresse</dt>
                <dd>
                  {client.adresse || "—"}
                  <br />
                  {client.ville}, Maroc
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">ICE</dt>
                <dd className="tabular">{client.ice || "—"}</dd>
              </div>
            </div>
          </dl>
          <div className="mt-5 flex items-center gap-3 rounded-lg bg-accent/60 p-3">
            <UserAvatar nom={commercial?.nom ?? "?"} className="size-9" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Commercial responsable</p>
              <p className="truncate text-sm font-medium">{commercial?.nom ?? "—"}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Achats sur 12 mois" description="Chiffre d'affaires TTC par mois">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={h.parMois} margin={{ left: -10, right: 4, top: 8 }}>
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
                <Bar
                  dataKey="ca"
                  name="Chiffre d'affaires"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <Tabs defaultValue="commandes">
        <TabsList className="mb-3 h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="commandes">Commandes ({h.commandes.length})</TabsTrigger>
          <TabsTrigger value="devis">Devis ({h.devis.length})</TabsTrigger>
          <TabsTrigger value="factures">Factures ({h.factures.length})</TabsTrigger>
          <TabsTrigger value="paiements">Paiements ({h.paiements.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="commandes" className="card-surface overflow-hidden">
          <DataTable
            rows={h.commandes}
            columns={cmdCols}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate({ to: "/commandes/$id", params: { id: c.id } })}
            emptyTitle="Aucune commande"
            emptyDescription="Ce client n'a pas encore passé de commande."
            mobileCard={(c) =>
              mobileDoc(
                c.numero,
                c.date,
                totaux(c).ttc,
                <StatusBadge tone={COMMANDE_STATUTS[c.statut].tone}>
                  {COMMANDE_STATUTS[c.statut].label}
                </StatusBadge>,
              )
            }
          />
        </TabsContent>
        <TabsContent value="devis" className="card-surface overflow-hidden">
          <DataTable
            rows={h.devis}
            columns={devisCols}
            rowKey={(d) => d.id}
            onRowClick={(d) => navigate({ to: "/devis/$id", params: { id: d.id } })}
            emptyTitle="Aucun devis"
            emptyDescription="Créez un premier devis pour ce client."
            mobileCard={(d) =>
              mobileDoc(
                d.numero,
                d.date,
                totaux(d).ttc,
                <StatusBadge tone={DEVIS_STATUTS[d.statut].tone}>
                  {DEVIS_STATUTS[d.statut].label}
                </StatusBadge>,
              )
            }
          />
        </TabsContent>
        <TabsContent value="factures" className="card-surface overflow-hidden">
          <DataTable
            rows={h.factures}
            columns={facCols}
            rowKey={(f) => f.id}
            onRowClick={(f) => navigate({ to: "/factures/$id", params: { id: f.id } })}
            emptyTitle="Aucune facture"
            mobileCard={(f) => {
              const s = FACTURE_STATUTS[statutFacture(data, f)];
              return mobileDoc(
                f.numero,
                f.date,
                totaux(f).ttc,
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>,
              );
            }}
          />
        </TabsContent>
        <TabsContent value="paiements" className="card-surface overflow-hidden">
          <DataTable
            rows={h.paiements}
            columns={payCols}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate({ to: "/factures/$id", params: { id: p.factureId } })}
            emptyTitle="Aucun paiement"
            mobileCard={(p) =>
              mobileDoc(
                p.numero,
                p.date,
                p.montant,
                <span className="text-xs text-muted-foreground">{MODES_PAIEMENT[p.mode]}</span>,
              )
            }
          />
        </TabsContent>
      </Tabs>

      <ClientFormDialog open={edit} onOpenChange={setEdit} client={client} />
      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Supprimer ce client ?"
        description={`« ${client.nom} » et ses devis seront supprimés. Un client ayant des commandes ou des factures ne peut pas être supprimé.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          const r = tryAction(() => deleteClient(client.id));
          if (r.ok) {
            toast.success("Client supprimé.");
            navigate({ to: "/clients" });
          } else toast.error(r.error);
        }}
      />
    </div>
  );
}
