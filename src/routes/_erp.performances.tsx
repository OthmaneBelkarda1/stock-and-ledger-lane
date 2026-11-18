import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { CommercialPerformance } from "@/components/erp/commercial-performance";
import { PageHeader } from "@/components/erp/page-header";
import { fmtLongDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";

export const Route = createFileRoute("/_erp/performances")({
  head: pageHead(
    "Mes performances",
    "Objectif mensuel, taux de réalisation, évolution des ventes et classement.",
  ),
  component: PerformancesPage,
});

function PerformancesPage() {
  const { data, user, commandes, devis, clients } = useScoped();
  // Données limitées au commercial connecté : les chiffres des autres commerciaux ne sont jamais affichés.
  const scoped = { ...data, commandes: data.commandes, devis, clients };
  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {fmtLongDate(new Date())}
          </span>
        }
        title="Mes performances"
        description={`${commandes.length} commandes · ${clients.length} clients dans votre portefeuille`}
      />
      <CommercialPerformance data={scoped} user={user} mode="self" />
    </div>
  );
}
