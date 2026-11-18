import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  /** Masquer la colonne sous ce point de rupture (tablette) */
  hideBelow?: "lg" | "xl";
}

const hideCls = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  mobileCard,
  pageSize = 10,
  initialSort,
  emptyTitle = "Aucun résultat",
  emptyDescription = "Modifiez vos filtres ou votre recherche.",
  dense = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileCard: (row: T) => ReactNode;
  pageSize?: number;
  initialSort?: { id: string; dir: "asc" | "desc" };
  emptyTitle?: string;
  emptyDescription?: string;
  dense?: boolean;
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      const r =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr");
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [pages, page]);
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggle = (c: Column<T>) => {
    if (!c.sort) return;
    setSort((s) =>
      s?.id === c.id
        ? { id: c.id, dir: s.dir === "asc" ? "desc" : "asc" }
        : { id: c.id, dir: "asc" },
    );
  };

  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div>
      {/* Ordinateur & tablette */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              {columns.map((c) => (
                <th
                  key={c.id}
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                    c.align === "right"
                      ? "text-right"
                      : c.align === "center"
                        ? "text-center"
                        : "text-left",
                    c.hideBelow && hideCls[c.hideBelow],
                  )}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sort?.id === c.id ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn(
                  "border-b last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-accent/40",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "px-4 align-middle",
                      dense ? "py-2" : "py-3",
                      c.align === "right"
                        ? "text-right tabular"
                        : c.align === "center"
                          ? "text-center"
                          : "text-left",
                      c.hideBelow && hideCls[c.hideBelow],
                      c.className,
                    )}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Smartphone */}
      <ul className="divide-y md:hidden">
        {view.map((r) => (
          <li
            key={rowKey(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            className={cn("px-4 py-3", onRowClick && "cursor-pointer active:bg-accent/40")}
          >
            {mobileCard(r)}
          </li>
        ))}
      </ul>
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <span className="tabular">
            {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} sur{" "}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft />
            </Button>
            <span className="px-2 tabular">
              Page {page + 1} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
