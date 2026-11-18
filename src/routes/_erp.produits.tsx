import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, LayoutGrid, List, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { DataTable, type Column } from "@/components/erp/data-table";
import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/erp/page-header";
import { ProductDetailSheet } from "@/components/erp/product-detail-sheet";
import { ProductFormDialog } from "@/components/erp/product-form-dialog";
import { SearchInput, matches } from "@/components/erp/search-input";
import { StockBadge } from "@/components/erp/stock-badge";
import { stockDisponible } from "@/lib/erp/calc";
import { CATEGORIES } from "@/lib/erp/constants";
import { fmtMAD, fmtQty } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useCurrentUser, useData } from "@/lib/erp/hooks";
import { productImage } from "@/lib/erp/images";
import { can } from "@/lib/erp/permissions";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Product } from "@/lib/erp/types";

export const Route = createFileRoute("/_erp/produits")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: pageHead(
    "Produits",
    "Catalogue des carrelages, céramiques, marbres, mosaïques et accessoires.",
  ),
  component: ProduitsPage,
});

const ALL = "__all";

function ProduitsPage() {
  const data = useData();
  const user = useCurrentUser();
  const { q: initialQ } = Route.useSearch();
  const deleteProduct = useErp((s) => s.deleteProduct);
  const canEdit = can(user, "gerer_produits");
  const [q, setQ] = useState(initialQ ?? "");
  const [marque, setMarque] = useState(ALL);
  const [cat, setCat] = useState(ALL);
  const [dim, setDim] = useState(ALL);
  const [tri, setTri] = useState("nom");
  const [vue, setVue] = useState<"cartes" | "tableau">("cartes");
  const [edit, setEdit] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [detail, setDetail] = useState<Product>();
  const [toDelete, setToDelete] = useState<Product>();

  const marques = [...new Set(data.products.map((p) => p.marque))].sort();
  const dims = [...new Set(data.products.map((p) => p.dimension))];

  const rows = useMemo(() => {
    const list = data.products.filter(
      (p) =>
        matches(q, p.nom, p.sku, p.marque, p.collection, p.couleur) &&
        (marque === ALL || p.marque === marque) &&
        (cat === ALL || p.categorie === cat) &&
        (dim === ALL || p.dimension === dim),
    );
    const prix = (p: Product) => p.prixM2 || p.prixCarton;
    if (tri === "prix_asc") list.sort((a, b) => prix(a) - prix(b));
    else if (tri === "prix_desc") list.sort((a, b) => prix(b) - prix(a));
    else if (tri === "stock")
      list.sort((a, b) => stockDisponible(data, a.id) - stockDisponible(data, b.id));
    else list.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return list;
  }, [data, q, marque, cat, dim, tri]);

  const actions = (p: Product) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => setDetail(p)}>
          <Eye /> Consulter
        </DropdownMenuItem>
        {canEdit && (
          <DropdownMenuItem onSelect={() => setEdit({ open: true, product: p })}>
            <Pencil /> Modifier
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setToDelete(p)}
          >
            <Trash2 /> Supprimer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: Column<Product>[] = [
    {
      id: "nom",
      header: "Produit",
      sort: (p) => p.nom,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <img
            src={productImage(p.image)}
            alt=""
            loading="lazy"
            className="size-10 rounded-md object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{p.nom}</p>
            <p className="text-xs text-muted-foreground">
              {p.sku} · {p.marque}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "cat",
      header: "Catégorie",
      sort: (p) => p.categorie,
      cell: (p) => p.categorie,
      hideBelow: "lg",
    },
    { id: "dim", header: "Dimensions", cell: (p) => p.dimension },
    { id: "fin", header: "Finition", cell: (p) => p.finition, hideBelow: "xl" },
    {
      id: "m2",
      header: "Prix / m²",
      align: "right",
      sort: (p) => p.prixM2,
      cell: (p) => (p.prixM2 ? fmtMAD(p.prixM2) : "—"),
    },
    {
      id: "ct",
      header: "Prix / carton",
      align: "right",
      sort: (p) => p.prixCarton,
      cell: (p) => fmtMAD(p.prixCarton),
      hideBelow: "lg",
    },
    {
      id: "dispo",
      header: "Disponible",
      align: "right",
      sort: (p) => stockDisponible(data, p.id),
      cell: (p) => <span className="tabular">{stockDisponible(data, p.id)} ct</span>,
    },
    {
      id: "etat",
      header: "État",
      cell: (p) => <StockBadge dispo={stockDisponible(data, p.id)} seuil={p.seuilMin} />,
    },
    { id: "a", header: "", cell: actions, align: "right" },
  ];

  return (
    <div>
      <PageHeader
        title="Catalogue produits"
        description={`${data.products.length} références · carrelage, grès cérame, marbre, faïence, mosaïque et accessoires`}
        actions={
          canEdit && (
            <Button onClick={() => setEdit({ open: true })}>
              <Plus /> Ajouter un produit
            </Button>
          )
        }
      />

      <div className="card-surface mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Nom, référence, collection, couleur…"
          className="lg:w-72"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-1">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-10 bg-card lg:w-44">
              <SelectValue placeholder="Catégorie" />
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
          <Select value={marque} onValueChange={setMarque}>
            <SelectTrigger className="h-10 bg-card lg:w-40">
              <SelectValue placeholder="Marque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes marques</SelectItem>
              {marques.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dim} onValueChange={setDim}>
            <SelectTrigger className="h-10 bg-card lg:w-40">
              <SelectValue placeholder="Dimensions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes dimensions</SelectItem>
              {dims.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tri} onValueChange={setTri}>
            <SelectTrigger className="h-10 bg-card lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nom">Trier : nom</SelectItem>
              <SelectItem value="prix_asc">Prix croissant</SelectItem>
              <SelectItem value="prix_desc">Prix décroissant</SelectItem>
              <SelectItem value="stock">Disponibilité</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ToggleGroup
          type="single"
          value={vue}
          onValueChange={(v) => v && setVue(v as typeof vue)}
          variant="outline"
          className="self-end lg:self-auto"
        >
          <ToggleGroupItem value="cartes" aria-label="Vue cartes">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="tableau" aria-label="Vue tableau">
            <List className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {vue === "cartes" ? (
        rows.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {rows.map((p) => {
              const dispo = stockDisponible(data, p.id);
              return (
                <article
                  key={p.id}
                  onClick={() => setDetail(p)}
                  className="card-surface group cursor-pointer overflow-hidden transition-shadow hover:shadow-elevated fade-up"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={productImage(p.image)}
                      alt={p.nom}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3">
                      <StockBadge dispo={dispo} seuil={p.seuilMin} />
                    </div>
                    <div className="absolute right-2 top-2 rounded-md bg-card/90">{actions(p)}</div>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {p.categorie} · {p.marque}
                    </p>
                    <h3 className="mt-1 truncate font-semibold">{p.nom}</h3>
                    <p className="text-xs text-muted-foreground">
                      {p.dimension} · {p.finition} · {p.couleur}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="font-semibold tabular">
                          {p.prixM2 ? `${fmtMAD(p.prixM2)}` : fmtMAD(p.prixCarton)}
                          <span className="text-xs font-normal text-muted-foreground">
                            {" "}
                            / {p.prixM2 ? "m²" : "carton"}
                          </span>
                        </p>
                        {p.m2ParCarton > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            {fmtMAD(p.prixCarton)} le carton de {fmtQty(p.m2ParCarton)} m²
                          </p>
                        )}
                      </div>
                      <p className="text-right text-xs text-muted-foreground">
                        <span className="block text-sm font-semibold text-foreground tabular">
                          {dispo}
                        </span>
                        cartons
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card-surface">
            <EmptyState
              title="Aucun produit trouvé"
              description="Modifiez vos filtres ou votre recherche."
            />
          </div>
        )
      ) : (
        <div className="card-surface overflow-hidden">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(p) => p.id}
            onRowClick={setDetail}
            pageSize={12}
            mobileCard={(p) => (
              <div className="flex items-center gap-3">
                <img
                  src={productImage(p.image)}
                  alt=""
                  className="size-12 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.dimension} · {p.prixM2 ? `${fmtMAD(p.prixM2)}/m²` : fmtMAD(p.prixCarton)}
                  </p>
                </div>
                <StockBadge dispo={stockDisponible(data, p.id)} seuil={p.seuilMin} />
              </div>
            )}
          />
        </div>
      )}

      <ProductFormDialog
        open={edit.open}
        product={edit.product}
        onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))}
      />
      <ProductDetailSheet product={detail} onOpenChange={(o) => !o && setDetail(undefined)} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title="Supprimer ce produit ?"
        description={`« ${toDelete?.nom} » sera retiré du catalogue ainsi que ses lots en stock. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          const r = tryAction(() => deleteProduct(toDelete!.id));
          if (r.ok) toast.success("Produit supprimé.");
          else toast.error(r.error);
        }}
      />
    </div>
  );
}
