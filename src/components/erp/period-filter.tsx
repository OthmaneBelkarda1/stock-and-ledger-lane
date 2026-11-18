import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { fr } from "react-day-picker/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/erp/format";
import type { Periode } from "@/lib/erp/calc";

export const PERIODE_LABELS: Record<Periode, string> = {
  jour: "Aujourd'hui",
  semaine: "Cette semaine",
  mois: "Ce mois",
  annee: "Cette année",
  perso: "Personnalisée",
};

export interface PeriodValue {
  periode: Periode;
  from?: Date;
  to?: Date;
}

export function PeriodFilter({ value, onChange }: { value: PeriodValue; onChange: (v: PeriodValue) => void }) {
  const [open, setOpen] = useState(false);
  const opts: Periode[] = ["jour", "semaine", "mois", "annee"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-card">
        {opts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange({ periode: p })}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3",
              value.periode === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIODE_LABELS[p]}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={value.periode === "perso" ? "default" : "outline"} size="sm" className="h-8">
            <CalendarRange />
            {value.periode === "perso" && value.from ? `${fmtDate(value.from.toISOString())} → ${fmtDate((value.to ?? value.from).toISOString())}` : "Période personnalisée"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            locale={fr}
            numberOfMonths={1}
            selected={{ from: value.from, to: value.to }}
            onSelect={(r) => {
              if (r?.from) onChange({ periode: "perso", from: r.from, to: r.to });
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
