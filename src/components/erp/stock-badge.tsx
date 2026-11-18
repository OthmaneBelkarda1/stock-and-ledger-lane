import { etatStock } from "@/lib/erp/calc";
import { StatusBadge } from "./status-badge";

export function StockBadge({ dispo, seuil }: { dispo: number; seuil: number }) {
  const e = etatStock(dispo, seuil);
  if (e === "rupture") return <StatusBadge tone="danger">Rupture</StatusBadge>;
  if (e === "faible") return <StatusBadge tone="warning">Stock faible</StatusBadge>;
  return <StatusBadge tone="success">En stock</StatusBadge>;
}
