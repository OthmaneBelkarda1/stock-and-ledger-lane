import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/erp/document-actions";
import { DocEditor } from "@/components/erp/doc-editor";
import { PageHeader } from "@/components/erp/page-header";
import { pageHead } from "@/lib/erp/head";

export const Route = createFileRoute("/_erp/devis/nouveau")({
  validateSearch: (s: Record<string, unknown>): { client?: string } => ({
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  head: pageHead("Nouveau devis", "Créer un devis client avec calcul automatique HT, TVA et TTC."),
  component: Page,
});

function Page() {
  const { client } = Route.useSearch();
  return (
    <div>
      <BackLink to="/devis" label="Retour aux devis" />
      <PageHeader
        title="Nouveau devis"
        description="Sélectionnez le client et les produits : les quantités en cartons, m² et pièces ainsi que les montants sont calculés automatiquement."
      />
      <DocEditor kind="devis" clientId={client} />
    </div>
  );
}
