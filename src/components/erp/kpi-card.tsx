import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/erp/format";

export function KpiCard({
  label,
  value,
  icon: Icon,
  evolution,
  comparaison,
  inverse = false,
  footer,
  accent = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  evolution?: number;
  comparaison?: string;
  inverse?: boolean;
  footer?: React.ReactNode;
  accent?: boolean;
}) {
  const up = (evolution ?? 0) > 0.05;
  const down = (evolution ?? 0) < -0.05;
  const good = inverse ? down : up;
  const bad = inverse ? up : down;
  const TrendIcon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <div className={cn("card-surface group relative overflow-hidden p-4 transition-shadow hover:shadow-elevated md:p-5", accent && "bg-primary text-primary-foreground border-primary")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("truncate text-xs font-medium uppercase tracking-wide", accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-tight tabular md:text-2xl">{value}</p>
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", accent ? "bg-primary-foreground/10" : "bg-accent text-accent-foreground")}>
          <Icon className="size-4" />
        </div>
      </div>
      {(evolution !== undefined || footer) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {evolution !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular",
                accent ? "bg-primary-foreground/10" : good ? "bg-success-soft text-success" : bad ? "bg-destructive-soft text-destructive" : "bg-secondary text-muted-foreground",
              )}
            >
              <TrendIcon className="size-3" />
              {fmtPct(evolution)}
            </span>
          )}
          {comparaison && <span className={cn("truncate", accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{comparaison}</span>}
          {footer}
        </div>
      )}
    </div>
  );
}
