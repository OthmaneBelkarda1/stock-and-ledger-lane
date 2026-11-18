import { fmtMAD, fmtInt } from "@/lib/erp/format";

type Entry = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

export function ChartTooltip({ active, payload, label, money = true, unit }: { active?: boolean; payload?: Entry[]; label?: string | number; money?: boolean | string[]; unit?: string }) {
  if (!active || !payload?.length) return null;
  const isMoney = (k?: string | number) => (Array.isArray(money) ? money.includes(String(k)) : money);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-elevated">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular">{isMoney(p.dataKey) ? fmtMAD(Number(p.value)) : `${fmtInt(Number(p.value))}${unit ? " " + unit : ""}`}</span>
        </div>
      ))}
    </div>
  );
}

export const axisProps = {
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const;

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--sand)"];
