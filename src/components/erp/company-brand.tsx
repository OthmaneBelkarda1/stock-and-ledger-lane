import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useErp } from "@/lib/erp/store";

/** Emplacement réservé au logo et au nom de la société cliente (modifiables dans Paramètres). */
export function CompanyLogo({ className, variant = "light" }: { className?: string; variant?: "light" | "dark" }) {
  const logo = useErp((s) => s.data.settings.societe.logo);
  if (logo) return <img src={logo} alt="Logo de la société" className={cn("size-9 rounded-md object-contain", className)} />;
  return (
    <div
      title="Emplacement du logo"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed",
        variant === "dark" ? "border-sidebar-primary/50 text-sidebar-primary" : "border-sand-foreground/40 bg-accent text-sand-foreground",
        className,
      )}
    >
      <Building2 className="size-4" />
    </div>
  );
}

export function CompanyName({ className }: { className?: string }) {
  const nom = useErp((s) => s.data.settings.societe.nom);
  return <span className={className}>{nom}</span>;
}
