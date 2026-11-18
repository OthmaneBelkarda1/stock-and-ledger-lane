import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NiveauNotif } from "@/lib/erp/types";

const map = {
  info: { icon: Info, cls: "bg-info-soft text-info" },
  succes: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  alerte: { icon: AlertTriangle, cls: "bg-warning-soft text-warning-foreground" },
  critique: { icon: OctagonAlert, cls: "bg-destructive-soft text-destructive" },
} as const;

export function NotifIcon({ niveau, className }: { niveau: NiveauNotif; className?: string }) {
  const { icon: Icon, cls } = map[niveau];
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        cls,
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
