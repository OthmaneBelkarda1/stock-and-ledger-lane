import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  return (
    <div className="card-surface mx-auto mt-10 flex max-w-md flex-col items-center p-10 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
        <ShieldAlert className="size-5" />
      </div>
      <h2 className="text-lg font-semibold">Accès réservé à l'administrateur</h2>
      <p className="mt-2 text-sm text-muted-foreground">Ce module n'est pas disponible avec votre profil. Contactez la direction si vous pensez qu'il s'agit d'une erreur.</p>
      <Button asChild className="mt-6">
        <Link to="/tableau-de-bord">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
