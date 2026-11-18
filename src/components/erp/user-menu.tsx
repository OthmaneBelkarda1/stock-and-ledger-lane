import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, LogOut, RotateCcw, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/erp/hooks";
import { initials } from "@/lib/erp/format";
import { ROLE_LABELS } from "@/lib/erp/permissions";
import { useSession } from "@/lib/erp/session";
import { useErp } from "@/lib/erp/store";
import { ConfirmDialog } from "./confirm-dialog";

export function UserAvatar({ nom, avatar, className }: { nom: string; avatar?: string; className?: string }) {
  return (
    <Avatar className={className}>
      {avatar && <AvatarImage src={avatar} alt={nom} />}
      <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{initials(nom)}</AvatarFallback>
    </Avatar>
  );
}

export function UserMenu() {
  const user = useCurrentUser();
  const logout = useSession((s) => s.logout);
  const loginAs = useSession((s) => s.loginAs);
  const resetDemo = useErp((s) => s.resetDemo);
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);

  const switchTo = (id: string, label: string) => {
    loginAs(id);
    navigate({ to: "/tableau-de-bord" });
    toast.success(`Vous êtes maintenant dans l'espace ${label}.`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2">
            <UserAvatar nom={user.nom} avatar={user.avatar} className="size-8" />
            <div className="hidden text-left leading-tight lg:block">
              <p className="text-sm font-medium">{user.nom}</p>
              <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{user.nom}</p>
            <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ to: "/activites" })}>
            <UserRound /> Mon historique d'activité
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Démonstration</DropdownMenuLabel>
          {user.role === "admin" ? (
            <DropdownMenuItem onSelect={() => switchTo("u-youssef", "commercial")}>
              <ArrowLeftRight /> Basculer vers l'espace commercial
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => switchTo("u-admin", "administrateur")}>
              <ArrowLeftRight /> Basculer vers l'espace administrateur
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
            <RotateCcw /> Réinitialiser la démonstration
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              logout();
              navigate({ to: "/" });
            }}
          >
            <LogOut /> Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Réinitialiser la démonstration ?"
        description="Toutes les modifications effectuées (clients, devis, commandes, paiements…) seront remplacées par les données initiales."
        confirmLabel="Réinitialiser"
        destructive
        onConfirm={() => {
          resetDemo();
          toast.success("Les données de démonstration ont été réinitialisées.");
        }}
      />
    </>
  );
}
