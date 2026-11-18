import { Link } from "@tanstack/react-router";
import { FileText, Plus, ShoppingCart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DemoGuide } from "./demo-guide";
import { GlobalSearch } from "./global-search";
import { NotificationsPopover } from "./notifications-popover";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 hidden h-6 md:block" />
      <div className="min-w-0 flex-1 sm:flex-none">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="hidden h-9 sm:inline-flex">
              <Plus /> Nouveau
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link to="/devis/nouveau">
                <FileText /> Nouveau devis
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/commandes/nouvelle">
                <ShoppingCart /> Nouvelle commande
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/clients" search={{ nouveau: true }}>
                <UserPlus /> Nouveau client
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DemoGuide />
        <NotificationsPopover />
        <UserMenu />
      </div>
    </header>
  );
}
