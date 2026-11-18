import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, LayoutDashboard, Menu, ShoppingCart, Users } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const items = [
  { title: "Accueil", url: "/tableau-de-bord", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Devis", url: "/devis", icon: FileText },
  { title: "Commandes", url: "/commandes", icon: ShoppingCart },
] as const;

/** Navigation inférieure sur smartphone. */
export function MobileNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((i) => {
          const active = path === i.url || path.startsWith(i.url + "/");
          return (
            <li key={i.url}>
              <Link to={i.url} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <i.icon className="size-5" />
                {i.title}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={() => setOpenMobile(true)} className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground">
            <Menu className="size-5" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
