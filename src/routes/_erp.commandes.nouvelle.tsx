import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/erp/document-actions";
import { DocEditor } from "@/components/erp/doc-editor";
import { PageHeader } from "@/components/erp/page-header";
import { pageHead } from "@/lib/erp/head";

export const Route = createFileRoute("/_erp/commandes/nouvelle")({
  validateSearch: (s: Record<string, unknown>): { client?: string } => ({
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  head: pageHead(
    "Nouvelle commande",
    "Saisir une commande client avec réservation automatique du stock.",
  ),
  component: Page,
});

function Page() {
  const { client } = Route.useSearch();
  return (
    <div>
      <BackLink to="/commandes" label="Retour aux commandes" />
      <PageHeader
        title="Nouvelle commande"
        description="Une commande confirmée réserve immédiatement les cartons nécessaires dans le stock."
      />
      <DocEditor kind="commande" clientId={client} />
    </div>
  );
}
