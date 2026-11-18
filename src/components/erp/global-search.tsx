import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Package, Receipt, Search, ShoppingCart, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useScoped } from "@/lib/erp/hooks";
import { fmtMAD } from "@/lib/erp/format";
import { totaux } from "@/lib/erp/calc";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data, clients, devis, commandes, factures } = useScoped();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const clientName = useMemo(
    () => Object.fromEntries(data.clients.map((c) => [c.id, c.nom])),
    [data.clients],
  );
  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-full justify-start gap-2 bg-card text-muted-foreground sm:w-64 lg:w-80"
      >
        <Search className="size-4" />
        <span className="truncate">Rechercher…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 text-[10px] font-medium lg:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Produit, client, devis, commande, facture…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup heading="Produits">
            {data.products.map((p) => (
              <CommandItem
                key={p.id}
                value={`produit ${p.nom} ${p.sku} ${p.marque}`}
                onSelect={() => go(() => navigate({ to: "/produits", search: { q: p.sku } }))}
              >
                <Package /> {p.nom}{" "}
                <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Clients">
            {clients.map((c) => (
              <CommandItem
                key={c.id}
                value={`client ${c.nom} ${c.ville}`}
                onSelect={() => go(() => navigate({ to: "/clients/$id", params: { id: c.id } }))}
              >
                <Users /> {c.nom}{" "}
                <span className="ml-auto text-xs text-muted-foreground">{c.ville}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Devis">
            {devis.slice(-30).map((d) => (
              <CommandItem
                key={d.id}
                value={`devis ${d.numero} ${clientName[d.clientId]}`}
                onSelect={() => go(() => navigate({ to: "/devis/$id", params: { id: d.id } }))}
              >
                <FileText /> {d.numero} · {clientName[d.clientId]}
                <span className="ml-auto text-xs text-muted-foreground">
                  {fmtMAD(totaux(d).ttc)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Commandes">
            {commandes.slice(-40).map((c) => (
              <CommandItem
                key={c.id}
                value={`commande ${c.numero} ${clientName[c.clientId]}`}
                onSelect={() => go(() => navigate({ to: "/commandes/$id", params: { id: c.id } }))}
              >
                <ShoppingCart /> {c.numero} · {clientName[c.clientId]}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Factures">
            {factures.slice(-40).map((f) => (
              <CommandItem
                key={f.id}
                value={`facture ${f.numero} ${clientName[f.clientId]}`}
                onSelect={() => go(() => navigate({ to: "/factures/$id", params: { id: f.id } }))}
              >
                <Receipt /> {f.numero} · {clientName[f.clientId]}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
