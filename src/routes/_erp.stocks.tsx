import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  Calculator,
  ClipboardCheck,
  Download,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Ruler,
  Trash2,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { DataTable, type Column } from "@/components/erp/data-table";
import { EmptyState } from "@/components/erp/empty-state";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { SearchInput, matches } from "@/components/erp/search-input";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { StockBadge } from "@/components/erp/stock-badge";
import {
  ConverterDialog,
  StockActionDialog,
  type StockAction,
} from "@/components/erp/stock-dialogs";
import { syntheseStock } from "@/lib/erp/analytics";
import { cartonsToM2, cartonsToPieces, stockPhysique } from "@/lib/erp/calc";
import { CATEGORIES, MOUVEMENT_TYPES } from "@/lib/erp/constants";
import { exportXlsx } from "@/lib/erp/export";
import { fmtDate, fmtDateTime, fmtInt, fmtMAD, fmtMADCompact, fmtQty } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useCurrentUser, useData } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import { can } from "@/lib/erp/permissions";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Depot, Lot, Movement, MovementType } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

const ONGLETS = ["etat", "lots", "mouvements", "alertes", "depots"] as const;
type Onglet = (typeof ONGLETS)[number];

export const Route = createFileRoute("/_erp/stocks")({
  validateSearch: (s: Record<string, unknown>): { onglet?: string; produit?: string } => ({
    onglet: typeof s.onglet === "string" ? s.onglet : undefined,
    produit: typeof s.produit === "string" ? s.produit : undefined,
  }),
  head: pageHead(
    "Stocks",
    "Stocks par dépôt, lots, calibres, tonalités, mouvements et inventaire.",
  ),
  component: StocksPage,
});

const ALL = "__all";

function StocksPage() {
  const data = useData();
  const user = useCurrentUser();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const canEdit = can(user, "gerer_stock");
  const onglet: Onglet = ONGLETS.includes(search.onglet as Onglet)
    ? (search.onglet as Onglet)
    : "etat";
  const setOnglet = (o: string) =>
    navigate({ to: "/stocks", search: { onglet: o, produit: search.produit }, replace: true });

  const [action, setAction] = useState<StockAction | null>(null);
  const [actionProduct, setActionProduct] = useState<string | undefined>();
  const [converter, setConverter] = useState(false);
  const s = useMemo(() => syntheseStock(data), [data]);

  const open = (a: StockAction, pid?: string) => {
    setActionProduct(pid);
    setAction(a);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestion des stocks"
        description={
          canEdit
            ? "Entrées, sorties, réservations, lots, calibres, tonalités et dépôts."
            : "Consultation des disponibilités en temps réel (lecture seule)."
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setConverter(true)}>
              <Calculator /> Convertisseur
            </Button>
            {canEdit && (
              <>
                <Button onClick={() => open("entree")}>
                  <ArrowDownToLine /> Entrée
                </Button>
                <Button variant="outline" onClick={() => open("sortie")}>
                  <ArrowUpFromLine /> Sortie
                </Button>
                <Button variant="outline" onClick={() => open("transfert")}>
                  <ArrowLeftRight /> Transfert
                </Button>
                <Button variant="outline" onClick={() => open("inventaire")}>
                  <ClipboardCheck /> Inventaire
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="Valeur du stock"
          value={fmtMADCompact(s.valeur)}
          icon={Boxes}
          footer={<span className="text-primary-foreground/70">{s.references} références</span>}
        />
        <KpiCard
          label="Surface en dépôt"
          value={`${fmtInt(s.m2)} m²`}
          icon={Ruler}
          footer={<span className="text-muted-foreground">{data.depots.length} dépôts</span>}
        />
        <KpiCard
          label="Cartons disponibles"
          value={fmtInt(s.disponible)}
          icon={Layers}
          footer={
            <span className="text-muted-foreground">
              {fmtInt(s.reserve)} réservés pour commandes
            </span>
          }
        />
        <KpiCard
          label="Produits en alerte"
          value={fmtInt(s.faible + s.rupture)}
          icon={AlertTriangle}
          footer={<span className="text-destructive">dont {s.rupture} en rupture</span>}
        />
      </div>

      <Tabs value={onglet} onValueChange={setOnglet}>
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="etat">État du stock</TabsTrigger>
            <TabsTrigger value="lots">Lots</TabsTrigger>
            <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
            <TabsTrigger value="alertes">
              Alertes{" "}
              {s.faible + s.rupture > 0 && (
                <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] text-white">
                  {s.faible + s.rupture}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="depots">Dépôts</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="etat" className="mt-4">
          <EtatStock canEdit={canEdit} onAction={open} />
        </TabsContent>
        <TabsContent value="lots" className="mt-4">
          <LotsTab initialProduct={search.produit} />
        </TabsContent>
        <TabsContent value="mouvements" className="mt-4">
          <MouvementsTab initialProduct={search.produit} />
        </TabsContent>
        <TabsContent value="alertes" className="mt-4">
          <AlertesTab canEdit={canEdit} onAction={open} />
        </TabsContent>
        <TabsContent value="depots" className="mt-4">
          <DepotsTab canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      <StockActionDialog
        action={action}
        productId={actionProduct}
        onOpenChange={(o) => !o && setAction(null)}
      />
      <ConverterDialog open={converter} onOpenChange={setConverter} />
    </div>
  );
}

/* ---------------- État du stock ---------------- */

function EtatStock({
  canEdit,
  onAction,
}: {
  canEdit: boolean;
  onAction: (a: StockAction, pid?: string) => void;
}) {
  const data = useData();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(ALL);
  const [depot, setDepot] = useState(ALL);
  const [etat, setEtat] = useState(ALL);
  const s = useMemo(() => syntheseStock(data), [data]);

  type Row = (typeof s.lignes)[number] & { depot: number };
  const rows: Row[] = useMemo(
    () =>
      s.lignes
        .map((l) => ({
          ...l,
          depot: depot === ALL ? l.physique : stockPhysique(data, l.product.id, depot),
        }))
        .filter(
          (l) =>
            matches(q, l.product.nom, l.product.sku, l.product.marque, l.product.collection) &&
            (cat === ALL || l.product.categorie === cat) &&
            (etat === ALL || l.etat === etat),
        ),
    [s, data, q, cat, depot, etat],
  );

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "État du stock",
          rows: rows.map((l) => ({
            Référence: l.product.sku,
            Produit: l.product.nom,
            Catégorie: l.product.categorie,
            Dimensions: l.product.dimension,
            "Physique (cartons)": l.physique,
            "Réservé (cartons)": l.reserve,
            "Disponible (cartons)": l.disponible,
            "Disponible (m²)": cartonsToM2(l.product, Math.max(0, l.disponible)),
            "Disponible (pièces)": cartonsToPieces(l.product, Math.max(0, l.disponible)),
            "Seuil (cartons)": l.product.seuilMin,
            "Valeur (DH)": Math.round(l.physique * l.product.prixCarton * 100) / 100,
            État: l.etat === "ok" ? "En stock" : l.etat === "faible" ? "Stock faible" : "Rupture",
          })),
        },
      ],
      "etat-du-stock.xlsx",
    ).then(() => toast.success("Export Excel généré."));

  const columns: Column<Row>[] = [
    {
      id: "p",
      header: "Produit",
      sort: (l) => l.product.nom,
      cell: (l) => (
        <div className="flex items-center gap-3">
          <img
            src={productImage(l.product.image)}
            alt=""
            loading="lazy"
            className="size-10 rounded-md object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{l.product.nom}</p>
            <p className="text-xs text-muted-foreground">
              {l.product.sku} · {l.product.dimension}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "phys",
      header: depot === ALL ? "Physique" : "Dans le dépôt",
      align: "right",
      sort: (l) => l.depot,
      cell: (l) => `${fmtInt(l.depot)} ct`,
    },
    {
      id: "res",
      header: "Réservé",
      align: "right",
      sort: (l) => l.reserve,
      cell: (l) => <span className="text-info">{fmtInt(l.reserve)} ct</span>,
      hideBelow: "lg",
    },
    {
      id: "dispo",
      header: "Disponible",
      align: "right",
      sort: (l) => l.disponible,
      cell: (l) => (
        <div>
          <p className="font-semibold">{fmtInt(l.disponible)} ct</p>
          <p className="text-[11px] text-muted-foreground">
            {l.product.m2ParCarton > 0 &&
              `${fmtQty(cartonsToM2(l.product, Math.max(0, l.disponible)))} m² · `}
            {fmtInt(cartonsToPieces(l.product, Math.max(0, l.disponible)))} pcs
          </p>
        </div>
      ),
    },
    {
      id: "seuil",
      header: "Seuil",
      align: "right",
      sort: (l) => l.product.seuilMin,
      cell: (l) => `${l.product.seuilMin} ct`,
      hideBelow: "xl",
    },
    {
      id: "rep",
      header: "Répartition",
      hideBelow: "xl",
      cell: (l) => (
        <div className="flex flex-wrap gap-1">
          {data.depots.map((d) => {
            const n = stockPhysique(data, l.product.id, d.id);
            return n > 0 ? (
              <span
                key={d.id}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {d.nom.replace("Dépôt ", "")} : {n}
              </span>
            ) : null;
          })}
        </div>
      ),
    },
    {
      id: "etat",
      header: "État",
      sort: (l) => l.disponible - l.product.seuilMin,
      cell: (l) => <StockBadge dispo={l.disponible} seuil={l.product.seuilMin} />,
    },
    ...(canEdit
      ? [
          {
            id: "a",
            header: "",
            align: "right" as const,
            cell: (l: Row) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction("entree", l.product.id);
                }}
              >
                <Plus /> Entrée
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Produit, référence, marque…"
          className="lg:w-72"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-1">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-10 bg-card lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes catégories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={depot} onValueChange={setDepot}>
            <SelectTrigger className="h-10 bg-card lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les dépôts</SelectItem>
              {data.depots.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={etat} onValueChange={setEtat}>
            <SelectTrigger className="col-span-2 h-10 bg-card sm:col-span-1 lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les états</SelectItem>
              <SelectItem value="ok">En stock</SelectItem>
              <SelectItem value="faible">Stock faible</SelectItem>
              <SelectItem value="rupture">Rupture</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exporter}>
          <Download /> Excel
        </Button>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(l) => l.product.id}
        pageSize={12}
        mobileCard={(l) => (
          <div className="flex items-center gap-3">
            <img
              src={productImage(l.product.image)}
              alt=""
              className="size-12 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.product.nom}</p>
              <p className="text-xs text-muted-foreground tabular">
                {fmtInt(l.disponible)} ct dispo · {fmtInt(l.reserve)} réservés
                {l.product.m2ParCarton > 0 &&
                  ` · ${fmtQty(cartonsToM2(l.product, Math.max(0, l.disponible)))} m²`}
              </p>
            </div>
            <StockBadge dispo={l.disponible} seuil={l.product.seuilMin} />
          </div>
        )}
      />
    </div>
  );
}

/* ---------------- Lots ---------------- */

function LotsTab({ initialProduct }: { initialProduct?: string }) {
  const data = useData();
  const [q, setQ] = useState("");
  const [produit, setProduit] = useState(initialProduct ?? ALL);
  const [depot, setDepot] = useState(ALL);
  const [calibre, setCalibre] = useState(ALL);
  const calibres = [...new Set(data.lots.map((l) => l.calibre))].sort();
  const prod = (id: string) => data.products.find((p) => p.id === id);
  const depotNom = (id: string) => data.depots.find((d) => d.id === id)?.nom ?? "—";

  const rows = data.lots.filter((l) => {
    const p = prod(l.productId);
    return (
      (produit === ALL || l.productId === produit) &&
      (depot === ALL || l.depotId === depot) &&
      (calibre === ALL || l.calibre === calibre) &&
      matches(q, l.numero, l.tonalite, l.refFabrication, p?.nom, p?.sku)
    );
  });

  const columns: Column<Lot>[] = [
    {
      id: "num",
      header: "N° de lot",
      sort: (l) => l.numero,
      cell: (l) => <span className="font-medium tabular">{l.numero}</span>,
    },
    {
      id: "p",
      header: "Produit",
      sort: (l) => prod(l.productId)?.nom ?? "",
      cell: (l) => {
        const p = prod(l.productId);
        return (
          <div className="flex items-center gap-2">
            {p && (
              <img src={productImage(p.image)} alt="" className="size-8 rounded object-cover" />
            )}
            <span className="truncate">{p?.nom ?? "—"}</span>
          </div>
        );
      },
    },
    {
      id: "cal",
      header: "Calibre",
      sort: (l) => l.calibre,
      cell: (l) => (
        <StatusBadge tone="primary" withDot={false}>
          {l.calibre}
        </StatusBadge>
      ),
    },
    {
      id: "ton",
      header: "Tonalité",
      sort: (l) => l.tonalite,
      cell: (l) => (
        <StatusBadge tone="sand" withDot={false}>
          {l.tonalite}
        </StatusBadge>
      ),
    },
    {
      id: "ref",
      header: "Réf. fabrication",
      cell: (l) => <span className="text-muted-foreground">{l.refFabrication}</span>,
      hideBelow: "xl",
    },
    {
      id: "dep",
      header: "Dépôt",
      sort: (l) => depotNom(l.depotId),
      cell: (l) => depotNom(l.depotId),
      hideBelow: "lg",
    },
    {
      id: "ct",
      header: "Cartons",
      align: "right",
      sort: (l) => l.cartons,
      cell: (l) => fmtInt(l.cartons),
    },
    {
      id: "m2",
      header: "m²",
      align: "right",
      sort: (l) => cartonsToM2(prod(l.productId) ?? { m2ParCarton: 0 }, l.cartons),
      cell: (l) => {
        const p = prod(l.productId);
        return p && p.m2ParCarton > 0 ? fmtQty(cartonsToM2(p, l.cartons)) : "—";
      },
    },
    {
      id: "date",
      header: "Entrée",
      sort: (l) => l.dateEntree,
      cell: (l) => fmtDate(l.dateEntree),
      hideBelow: "lg",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-sand-foreground/20 bg-accent/50 p-4 text-sm">
        <Layers className="mt-0.5 size-5 shrink-0 text-sand-foreground" />
        <p className="text-muted-foreground">
          <b className="text-foreground">Particularité céramique :</b> pour un même chantier, livrez
          des cartons issus du <b className="text-foreground">même lot, calibre et tonalité</b>.
          Deux lots différents peuvent présenter de légères variations de teinte ou de dimension.
        </p>
      </div>
      <div className="card-surface overflow-hidden">
        <div className="grid grid-cols-2 gap-2 border-b p-3 lg:flex lg:items-center">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Lot, tonalité, réf. fabrication…"
            className="col-span-2 lg:w-72"
          />
          <Select value={produit} onValueChange={setProduit}>
            <SelectTrigger className="col-span-2 h-10 bg-card sm:col-span-1 lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les produits</SelectItem>
              {data.products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={depot} onValueChange={setDepot}>
            <SelectTrigger className="h-10 bg-card lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les dépôts</SelectItem>
              {data.depots.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={calibre} onValueChange={setCalibre}>
            <SelectTrigger className="h-10 bg-card lg:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous calibres</SelectItem>
              {calibres.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(l) => l.id}
          pageSize={12}
          initialSort={{ id: "date", dir: "desc" }}
          emptyTitle="Aucun lot"
          mobileCard={(l) => {
            const p = prod(l.productId);
            return (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium tabular">
                    {l.numero}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {l.calibre} · {l.tonalite}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p?.nom} · {depotNom(l.depotId)}
                  </p>
                </div>
                <p className="text-right text-sm font-semibold tabular">{l.cartons} ct</p>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

/* ---------------- Mouvements ---------------- */

function MouvementsTab({ initialProduct }: { initialProduct?: string }) {
  const data = useData();
  const [type, setType] = useState(ALL);
  const [produit, setProduit] = useState(initialProduct ?? ALL);
  const [depot, setDepot] = useState(ALL);
  const prod = (id: string) => data.products.find((p) => p.id === id);
  const depotNom = (id?: string) => data.depots.find((d) => d.id === id)?.nom ?? "—";
  const userNom = (id: string) => data.users.find((u) => u.id === id)?.nom ?? "—";
  const cmdNum = (id?: string) => data.commandes.find((c) => c.id === id)?.numero;

  const rows = data.movements.filter(
    (m) =>
      (type === ALL || m.type === type) &&
      (produit === ALL || m.productId === produit) &&
      (depot === ALL || m.depotId === depot || m.depotDestId === depot),
  );

  const exporter = () =>
    exportXlsx(
      [
        {
          name: "Mouvements",
          rows: rows.map((m) => ({
            Date: fmtDateTime(m.date),
            Type: MOUVEMENT_TYPES[m.type].label,
            Produit: prod(m.productId)?.nom ?? "—",
            Cartons: m.quantite,
            Dépôt: depotNom(m.depotId),
            Destination: m.depotDestId ? depotNom(m.depotDestId) : "",
            Utilisateur: userNom(m.userId),
            Motif: m.motif,
            Commande: cmdNum(m.commandeId) ?? "",
          })),
        },
      ],
      "mouvements-de-stock.xlsx",
    ).then(() => toast.success("Export Excel généré."));

  const signe = (m: Movement) =>
    m.type === "entree"
      ? "+"
      : m.type === "sortie"
        ? "−"
        : m.type === "inventaire" && m.quantite > 0
          ? "+"
          : "";

  const columns: Column<Movement>[] = [
    {
      id: "date",
      header: "Date",
      sort: (m) => m.date,
      cell: (m) => (
        <span className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.date)}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      sort: (m) => m.type,
      cell: (m) => (
        <StatusBadge tone={MOUVEMENT_TYPES[m.type].tone}>
          {MOUVEMENT_TYPES[m.type].label}
        </StatusBadge>
      ),
    },
    {
      id: "p",
      header: "Produit",
      sort: (m) => prod(m.productId)?.nom ?? "",
      cell: (m) => (
        <span className="font-medium">{prod(m.productId)?.nom ?? "Produit supprimé"}</span>
      ),
    },
    {
      id: "q",
      header: "Cartons",
      align: "right",
      sort: (m) => m.quantite,
      cell: (m) => (
        <span
          className={cn(
            "font-semibold",
            m.type === "entree" && "text-success",
            m.type === "sortie" && "text-destructive",
          )}
        >
          {signe(m)}
          {fmtInt(Math.abs(m.quantite))}
        </span>
      ),
    },
    {
      id: "dep",
      header: "Dépôt",
      cell: (m) =>
        m.depotDestId ? `${depotNom(m.depotId)} → ${depotNom(m.depotDestId)}` : depotNom(m.depotId),
      hideBelow: "lg",
    },
    {
      id: "motif",
      header: "Motif",
      hideBelow: "lg",
      cell: (m) => {
        const num = cmdNum(m.commandeId);
        return (
          <div className="max-w-[280px]">
            <p className="truncate text-muted-foreground">{m.motif}</p>
            {num && m.commandeId && (
              <Link
                to="/commandes/$id"
                params={{ id: m.commandeId }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium text-primary hover:underline"
              >
                {num}
              </Link>
            )}
          </div>
        );
      },
    },
    { id: "u", header: "Utilisateur", cell: (m) => userNom(m.userId), hideBelow: "xl" },
  ];

  return (
    <div className="card-surface overflow-hidden">
      <div className="grid grid-cols-2 gap-2 border-b p-3 lg:flex lg:items-center">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-10 bg-card lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les types</SelectItem>
            {(Object.keys(MOUVEMENT_TYPES) as MovementType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {MOUVEMENT_TYPES[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={depot} onValueChange={setDepot}>
          <SelectTrigger className="h-10 bg-card lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les dépôts</SelectItem>
            {data.depots.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={produit} onValueChange={setProduit}>
          <SelectTrigger className="col-span-2 h-10 bg-card lg:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les produits</SelectItem>
            {data.products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="col-span-2 lg:ml-auto" onClick={exporter}>
          <Download /> Excel
        </Button>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(m) => m.id}
        pageSize={15}
        dense
        initialSort={{ id: "date", dir: "desc" }}
        emptyTitle="Aucun mouvement"
        mobileCard={(m) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusBadge tone={MOUVEMENT_TYPES[m.type].tone}>
                  {MOUVEMENT_TYPES[m.type].label}
                </StatusBadge>
                <span className="text-xs text-muted-foreground">{fmtDate(m.date)}</span>
              </div>
              <p className="mt-1 truncate text-sm font-medium">{prod(m.productId)?.nom ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{m.motif}</p>
            </div>
            <p className="font-semibold tabular">
              {signe(m)}
              {fmtInt(Math.abs(m.quantite))} ct
            </p>
          </div>
        )}
      />
    </div>
  );
}

/* ---------------- Alertes ---------------- */

function AlertesTab({
  canEdit,
  onAction,
}: {
  canEdit: boolean;
  onAction: (a: StockAction, pid?: string) => void;
}) {
  const data = useData();
  const s = useMemo(() => syntheseStock(data), [data]);
  const alertes = s.lignes
    .filter((l) => l.etat !== "ok")
    .sort((a, b) => a.disponible - b.disponible);
  const fournisseur = (id: string) => data.suppliers.find((f) => f.id === id);

  if (!alertes.length)
    return (
      <div className="card-surface">
        <EmptyState
          icon={ClipboardCheck}
          title="Aucune alerte"
          description="Tous les produits sont au-dessus de leur seuil minimal."
        />
      </div>
    );

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {alertes.map((l) => {
        const suggestion = Math.max(0, l.product.seuilMin * 2 - l.disponible);
        const f = fournisseur(l.product.fournisseurId);
        return (
          <article
            key={l.product.id}
            className={cn(
              "card-surface fade-up overflow-hidden border-l-4",
              l.etat === "rupture" ? "border-l-destructive" : "border-l-warning",
            )}
          >
            <div className="flex gap-3 p-4">
              <img
                src={productImage(l.product.image)}
                alt=""
                className="size-14 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold">{l.product.nom}</p>
                  <StockBadge dispo={l.disponible} seuil={l.product.seuilMin} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {l.product.sku} · {l.product.dimension}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-3 border-t text-center text-xs">
              <div className="border-r p-2.5">
                <dt className="text-muted-foreground">Disponible</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular">{l.disponible} ct</dd>
              </div>
              <div className="border-r p-2.5">
                <dt className="text-muted-foreground">Réservé</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular">{l.reserve} ct</dd>
              </div>
              <div className="p-2.5">
                <dt className="text-muted-foreground">Seuil</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular">{l.product.seuilMin} ct</dd>
              </div>
            </dl>
            <div className="space-y-2 border-t bg-muted/30 p-4 text-sm">
              <p>
                Réapprovisionnement suggéré : <b className="tabular">{suggestion} cartons</b>
                {l.product.m2ParCarton > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({fmtQty(cartonsToM2(l.product, suggestion))} m²)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Fournisseur : <span className="text-foreground">{f?.nom ?? "—"}</span>
                {f && ` · ${f.telephone}`} · coût estimé {fmtMAD(suggestion * l.product.prixCarton)}
              </p>
              {canEdit && (
                <Button
                  size="sm"
                  className="mt-1 w-full"
                  onClick={() => onAction("entree", l.product.id)}
                >
                  <ArrowDownToLine /> Enregistrer une réception
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------------- Dépôts ---------------- */

function DepotsTab({ canEdit }: { canEdit: boolean }) {
  const data = useData();
  const deleteDepot = useErp((s) => s.deleteDepot);
  const [edit, setEdit] = useState<{ open: boolean; depot?: Depot }>({ open: false });
  const [toDelete, setToDelete] = useState<Depot>();

  const stats = (id: string) => {
    const lots = data.lots.filter((l) => l.depotId === id);
    let valeur = 0;
    let m2 = 0;
    for (const l of lots) {
      const p = data.products.find((x) => x.id === l.productId);
      if (!p) continue;
      valeur += l.cartons * p.prixCarton;
      m2 += l.cartons * p.m2ParCarton;
    }
    return {
      cartons: lots.reduce((s, l) => s + l.cartons, 0),
      refs: new Set(lots.map((l) => l.productId)).size,
      lots: lots.length,
      valeur,
      m2,
    };
  };
  const totalValeur = data.depots.reduce((s, d) => s + stats(d.id).valeur, 0) || 1;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setEdit({ open: true })}>
            <Plus /> Ajouter un dépôt
          </Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.depots.map((d) => {
          const st = stats(d.id);
          const part = (st.valeur / totalValeur) * 100;
          return (
            <SectionCard
              key={d.id}
              title={
                <span className="flex items-center gap-2">
                  <Warehouse className="size-4 text-muted-foreground" />
                  {d.nom}
                </span>
              }
              description={
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {d.adresse}, {d.ville}
                </span>
              }
              action={
                canEdit && (
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Modifier le dépôt"
                      onClick={() => setEdit({ open: true, depot: d })}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label="Supprimer le dépôt"
                      onClick={() => setToDelete(d)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )
              }
            >
              <p className="text-2xl font-semibold tabular">{fmtMAD(st.valeur)}</p>
              <p className="text-xs text-muted-foreground">
                valeur du stock · {fmtQty(part)} % du total
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, part)}%` }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted/50 p-2">
                  <dd className="text-sm font-semibold tabular">{fmtInt(st.cartons)}</dd>
                  <dt className="text-muted-foreground">cartons</dt>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <dd className="text-sm font-semibold tabular">{fmtInt(st.m2)}</dd>
                  <dt className="text-muted-foreground">m²</dt>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <dd className="text-sm font-semibold tabular">{st.refs}</dd>
                  <dt className="text-muted-foreground">références</dt>
                </div>
              </dl>
            </SectionCard>
          );
        })}
      </div>
      <DepotDialog
        open={edit.open}
        depot={edit.depot}
        onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title="Supprimer ce dépôt ?"
        description={`« ${toDelete?.nom} » sera supprimé. Un dépôt contenant encore du stock ne peut pas être supprimé.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          const r = tryAction(() => deleteDepot(toDelete!.id));
          if (r.ok) toast.success("Dépôt supprimé.");
          else toast.error(r.error);
        }}
      />
    </div>
  );
}

function DepotDialog({
  open,
  onOpenChange,
  depot,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  depot?: Depot;
}) {
  const saveDepot = useErp((s) => s.saveDepot);
  const [f, setF] = useState({ nom: "", ville: "", adresse: "" });
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string>("");
  const key = `${open}-${depot?.id ?? "new"}`;
  if (key !== lastKey) {
    setLastKey(key);
    setF({ nom: depot?.nom ?? "", ville: depot?.ville ?? "", adresse: depot?.adresse ?? "" });
    setError(null);
  }
  const submit = () => {
    if (!f.nom.trim() || !f.ville.trim()) return setError("Le nom et la ville sont obligatoires.");
    const r = tryAction(() =>
      saveDepot({
        ...f,
        nom: f.nom.trim(),
        ville: f.ville.trim(),
        adresse: f.adresse.trim(),
        id: depot?.id,
      }),
    );
    if (!r.ok) return setError(r.error);
    toast.success(depot ? "Dépôt modifié." : "Dépôt ajouté.");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{depot ? "Modifier le dépôt" : "Nouveau dépôt"}</DialogTitle>
          <DialogDescription>
            Lieu de stockage physique des cartons (entrepôt, showroom…).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input
              className="h-10"
              value={f.nom}
              onChange={(e) => setF({ ...f, nom: e.target.value })}
              placeholder="Dépôt de Marrakech"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ville</Label>
            <Input
              className="h-10"
              value={f.ville}
              onChange={(e) => setF({ ...f, ville: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input
              className="h-10"
              value={f.adresse}
              onChange={(e) => setF({ ...f, adresse: e.target.value })}
            />
          </div>
          {error && (
            <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
