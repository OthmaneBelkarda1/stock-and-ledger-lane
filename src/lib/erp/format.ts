const TZ = "Africa/Casablanca";

const numberFmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Remplace les espaces fines insécables par des espaces insécables standard (meilleur rendu PDF). */
const clean = (s: string) => s.replace(/\u202f/g, "\u00a0");

export const fmtMAD = (n: number) => clean(numberFmt.format(n || 0)) + "\u00a0DH";
export const fmtMADCompact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return clean(qtyFmt.format(n / 1_000_000)) + "\u00a0M DH";
  if (a >= 10_000) return clean(intFmt.format(n / 1000)) + "\u00a0k DH";
  return clean(intFmt.format(n)) + "\u00a0DH";
};
export const fmtNum = (n: number) => clean(numberFmt.format(n || 0));
export const fmtInt = (n: number) => clean(intFmt.format(n || 0));
export const fmtQty = (n: number) => clean(qtyFmt.format(n || 0));
export const fmtPct = (n: number) => (n > 0 ? "+" : "") + clean(qtyFmt.format(Math.round(n * 10) / 10)) + "\u00a0%";

export const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
};
export const fmtDateTime = (iso?: string) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
};
export const fmtMonthShort = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, month: "short" }).format(d).replace(".", "");
export const fmtLongDate = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return fmtDate(iso);
};

export const toInputDate = (iso: string) => iso.slice(0, 10);
export const fromInputDate = (v: string) => new Date(v + "T12:00:00").toISOString();

export const initials = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export const uid = (prefix = "") => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
