import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/erp/dashboard/admin-dashboard";
import { CommercialDashboard } from "@/components/erp/dashboard/commercial-dashboard";
import { useCurrentUser } from "@/lib/erp/hooks";
import { pageHead } from "@/lib/erp/head";

export const Route = createFileRoute("/_erp/tableau-de-bord")({
  head: pageHead("Tableau de bord", "Indicateurs clés, ventes, stocks et performances commerciales."),
  component: Page,
});

function Page() {
  const user = useCurrentUser();
  return user.role === "admin" ? <AdminDashboard /> : <CommercialDashboard />;
}
