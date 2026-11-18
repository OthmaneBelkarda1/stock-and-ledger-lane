import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink, DocNotFound } from "@/components/erp/document-actions";
import { DocEditor } from "@/components/erp/doc-editor";
import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/erp/page-header";
import { COMMANDE_STATUTS } from "@/lib/erp/constants";
import { pageHead } from "@/lib/erp/head";
import { useScoped } from "@/lib/erp/hooks";

export const Route = createFileRoute("/_erp/commandes/$id/modifier")({
  head: pageHead("Modifier la commande", "Modification d'une commande client."),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { commandes } = useScoped();
  const c = commandes.find((x) => x.id === id);
  if (!c) return <DocNotFound title="Commande introuvable" back="/commandes" />;
  if (c.statut === "livree" || c.statut === "annulee" || c.factureId)
    return (
      <div className="card-surface mx-auto mt-6 max-w-lg">
        <EmptyState
          icon={Lock}
          title="Cette commande ne peut plus être modifiée"
          description={
            c.factureId
              ? `La commande ${c.numero} a déjà été facturée.`
              : `La commande ${c.numero} est « ${COMMANDE_STATUTS[c.statut].label} ».`
          }
          action={
            <Button asChild variant="outline">
              <Link to="/commandes/$id" params={{ id: c.id }}>
                Retour à la commande
              </Link>
            </Button>
          }
        />
      </div>
    );
  return (
    <div>
      <BackLink to="/commandes" label="Retour aux commandes" />
      <PageHeader
        title={`Modifier la commande ${c.numero}`}
        description="Les réservations de stock sont recalculées automatiquement selon les nouvelles quantités."
      />
      <DocEditor key={c.id} kind="commande" existing={c} />
    </div>
  );
}
