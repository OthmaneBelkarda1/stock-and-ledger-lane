import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Globe2,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Truck,
  UserRound,
  Wallet,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { DataTable, type Column } from "@/components/erp/data-table";
import { EmptyState } from "@/components/erp/empty-state";
import { KpiCard } from "@/components/erp/kpi-card";
import { PageHeader } from "@/components/erp/page-header";
import { SearchInput, matches } from "@/components/erp/search-input";
import { StatusBadge } from "@/components/erp/status-badge";
import { SupplierFormDialog } from "@/components/erp/supplier-form-dialog";
import { round2, stockPhysique } from "@/lib/erp/calc";
import { fmtDate, fmtInt, fmtMAD, fmtMADCompact, fmtQty } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useData } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import { tryAction, useErp } from "@/lib/erp/store";
import type { ErpData, Supplier } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/fournisseurs/")({
  head: pageHead(
    "Fournisseurs",
    "Fabricants et distributeurs : coordonnées, produits fournis et historique des approvisionnements.",
  ),
  component: FournisseursPage,
});

function statsFournisseur(data: ErpData, id: string) {
  const produits = data.products.filter((p) => p.fournisseurId === id);
  const entrees = data.movements
    .filter((m) => m.type === "entree" && m.fournisseurId === id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const prix = (pid: string) => data.products.find((p) => p.id === pid)?.prixCarton ?? 0;
  const cartons = entrees.reduce((s, m) => s + m.quantite, 0);
  const valeur = round2(entrees.reduce((s, m) => s + m.quantite * prix(m.productId), 0));
  return { produits, entrees, cartons, valeur, dernier: entrees[0]?.date };
}

function FournisseursPage() {
  const data = useData();
  const deleteSupplier = useErp((s) => s.deleteSupplier);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  const [detail, setDetail] = useState<Supplier>();
  const [toDelete, setToDelete] = useState<Supplier>();

  const rows = useMemo(
    () =>
      data.suppliers
        .filter((s) => matches(q, s.nom, s.contact, s.ville, s.pays, s.email))
        .map((s) => ({ s, ...statsFournisseur(data, s.id) })),
    [data, q],
  );
  type Row = (typeof rows)[number];

  const totalValeur = rows.reduce((s, r) => s + r.valeur, 0);
  const pays = new Set(data.suppliers.map((s) => s.pays)).size;
  const import_ = data.suppliers.filter((s) => s.pays !== "Maroc").length;

  const actions = (s: Supplier) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => setDetail(s)}>
          <Truck /> Fiche fournisseur
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setEdit({ open: true, supplier: s })}>
          <Pencil /> Modifier
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setToDelete(s)}
        >
          <Trash2 /> Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: Column<Row>[] = [
    {
      id: "nom",
      header: "Fournisseur",
      sort: (r) => r.s.nom,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Truck className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{r.s.nom}</p>
            <p className="truncate text-xs text-muted-foreground">
              {r.s.contact} · {r.s.telephone}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "ville",
      header: "Localisation",
      sort: (r) => r.s.pays + r.s.ville,
      cell: (r) => `${r.s.ville}, ${r.s.pays}`,
    },
    {
      id: "prod",
      header: "Produits",
      align: "right",
      sort: (r) => r.produits.length,
      cell: (r) => fmtInt(r.produits.length),
    },
    {
      id: "ct",
      header: "Cartons reçus",
      align: "right",
      sort: (r) => r.cartons,
      cell: (r) => fmtInt(r.cartons),
      hideBelow: "lg",
    },
    {
      id: "val",
      header: "Valeur reçue",
      align: "right",
      sort: (r) => r.valeur,
      cell: (r) => fmtMAD(r.valeur),
    },
    {
      id: "der",
      header: "Dernière livraison",
      sort: (r) => r.dernier ?? "",
      cell: (r) => fmtDate(r.dernier),
      hideBelow: "xl",
    },
    { id: "a", header: "", align: "right", cell: (r) => actions(r.s) },
  ];

  const d = detail ? statsFournisseur(data, detail.id) : undefined;

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        description="Fabricants et distributeurs, produits fournis et historique des approvisionnements."
        actions={
          <Button onClick={() => setEdit({ open: true })}>
            <Plus /> Nouveau fournisseur
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          accent
          label="Fournisseurs"
          value={fmtInt(data.suppliers.length)}
          icon={Truck}
          footer={<span className="text-primary-foreground/70">{pays} pays</span>}
        />
        <KpiCard
          label="Fournisseurs import"
          value={fmtInt(import_)}
          icon={Globe2}
          footer={<span className="text-muted-foreground">hors Maroc</span>}
        />
        <KpiCard
          label="Références fournies"
          value={fmtInt(data.products.length)}
          icon={Package}
          footer={<span className="text-muted-foreground">au catalogue</span>}
        />
        <KpiCard
          label="Valeur des approvisionnements"
          value={fmtMADCompact(totalValeur)}
          icon={Wallet}
          footer={<span className="text-muted-foreground">au prix catalogue</span>}
        />
      </div>

      <div className="card-surface mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Nom, contact, ville, pays…"
          className="sm:w-80"
        />
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {rows.length} fournisseur{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="card-surface overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.s.id}
          onRowClick={(r) => setDetail(r.s)}
          initialSort={{ id: "val", dir: "desc" }}
          emptyTitle="Aucun fournisseur trouvé"
          mobileCard={(r) => (
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Truck className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.s.nom}</p>
                <p className="text-xs text-muted-foreground">
                  {r.s.ville}, {r.s.pays} · {r.produits.length} produits
                </p>
              </div>
              <p className="text-sm font-semibold tabular">{fmtMADCompact(r.valeur)}</p>
            </div>
          )}
        />
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detail && d && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.nom}</SheetTitle>
                <SheetDescription>
                  {detail.ville}, {detail.pays}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-8">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p className="flex items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" /> {detail.contact}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />{" "}
                    <a
                      href={`tel:${detail.telephone.replace(/\s/g, "")}`}
                      className="hover:underline"
                    >
                      {detail.telephone}
                    </a>
                  </p>
                  <p className="flex items-center gap-2 sm:col-span-2">
                    <Mail className="size-4 text-muted-foreground" />{" "}
                    <a href={`mailto:${detail.email}`} className="truncate hover:underline">
                      {detail.email || "—"}
                    </a>
                  </p>
                  <p className="flex items-center gap-2 sm:col-span-2">
                    <MapPin className="size-4 text-muted-foreground" /> {detail.adresse || "—"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-lg font-semibold tabular">{d.produits.length}</p>
                    <p className="text-[11px] text-muted-foreground">produits</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-lg font-semibold tabular">{fmtInt(d.cartons)}</p>
                    <p className="text-[11px] text-muted-foreground">cartons reçus</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-lg font-semibold tabular">{fmtMADCompact(d.valeur)}</p>
                    <p className="text-[11px] text-muted-foreground">valeur reçue</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Package className="size-4" /> Produits fournis
                  </h3>
                  {d.produits.length ? (
                    <ul className="divide-y rounded-lg border">
                      {d.produits.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 p-2.5">
                          <img
                            src={productImage(p.image)}
                            alt=""
                            className="size-10 rounded-md object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.nom}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.sku} · {p.dimension}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p className="font-medium tabular">
                              {p.prixM2 ? `${fmtMAD(p.prixM2)}/m²` : fmtMAD(p.prixCarton)}
                            </p>
                            <p className="text-muted-foreground tabular">
                              {fmtInt(stockPhysique(data, p.id))} ct en stock
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun produit rattaché à ce fournisseur.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Boxes className="size-4" /> Historique des approvisionnements
                  </h3>
                  {d.entrees.length ? (
                    <ul className="divide-y rounded-lg border">
                      {d.entrees.slice(0, 25).map((m) => {
                        const p = data.products.find((x) => x.id === m.productId);
                        const depot = data.depots.find((x) => x.id === m.depotId);
                        return (
                          <li
                            key={m.id}
                            className="flex items-start justify-between gap-3 p-2.5 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p?.nom ?? "Produit supprimé"}</p>
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(m.date)} · {depot?.nom ?? "—"}
                                {m.lot ? ` · lot ${m.lot}` : ""}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <StatusBadge tone="success">+{fmtInt(m.quantite)} ct</StatusBadge>
                              {p && p.m2ParCarton > 0 && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground tabular">
                                  {fmtQty(m.quantite * p.m2ParCarton)} m²
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="rounded-lg border">
                      <EmptyState
                        icon={Boxes}
                        title="Aucun approvisionnement"
                        description="Les entrées de stock liées à ce fournisseur apparaîtront ici."
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEdit({ open: true, supplier: detail });
                    }}
                  >
                    <Pencil /> Modifier
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(detail)}
                  >
                    <Trash2 /> Supprimer
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <SupplierFormDialog
        open={edit.open}
        supplier={edit.supplier}
        onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title="Supprimer ce fournisseur ?"
        description={`« ${toDelete?.nom ?? ""} » sera supprimé. Un fournisseur auquel des produits sont rattachés ne peut pas être supprimé.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          const r = tryAction(() => deleteSupplier(toDelete.id));
          if (r.ok) {
            toast.success("Fournisseur supprimé.");
            setDetail(undefined);
          } else toast.error(r.error);
        }}
      />
    </div>
  );
}
