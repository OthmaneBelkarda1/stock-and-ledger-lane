import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink, DocNotFound } from "@/components/erp/document-actions";
import { DocEditor } from "@/components/erp/doc-editor";
import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/erp/page-header";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";

export const Route = createFileRoute("/_erp/devis/$id/modifier")({
  head: pageHead("Modifier le devis", "Modification d'un devis client."),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { devis } = useScoped();
  const dv = devis.find((d) => d.id === id);
  if (!dv) return <DocNotFound title="Devis introuvable" back="/devis" />;
  if (dv.commandeId)
    return (
      <div className="card-surface mx-auto mt-6 max-w-lg">
        <EmptyState
          icon={Lock}
          title="Ce devis ne peut plus être modifié"
          description={`Le devis ${dv.numero} a déjà été transformé en commande. Dupliquez-le pour proposer une nouvelle offre.`}
          action={
            <Button asChild variant="outline">
              <Link to="/devis/$id" params={{ id: dv.id }}>
                Retour au devis
              </Link>
            </Button>
          }
        />
      </div>
    );
  return (
    <div>
      <BackLink to="/devis" label="Retour aux devis" />
      <PageHeader
        title={`Modifier le devis ${dv.numero}`}
        description="Les montants sont recalculés automatiquement à chaque modification."
      />
      <DocEditor key={dv.id} kind="devis" existing={dv} />
    </div>
  );
}
