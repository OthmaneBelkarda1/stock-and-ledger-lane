import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, Pencil, Phone, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommercialPerformance } from "@/components/erp/commercial-performance";
import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { UserAvatar } from "@/components/erp/user-menu";
import { UserFormDialog } from "@/components/erp/user-form-dialog";
import { fmtDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useData } from "@/lib/erp/hooks";

export const Route = createFileRoute("/_erp/commerciaux/$id")({
  head: pageHead(
    "Profil commercial",
    "Performances, objectifs, clients, commandes et devis d'un commercial.",
  ),
  component: CommercialPage,
});

function CommercialPage() {
  const { id } = Route.useParams();
  const data = useData();
  const [edit, setEdit] = useState(false);
  const user = data.users.find((u) => u.id === id && u.role === "commercial");

  if (!user) {
    return (
      <div className="card-surface mx-auto mt-6 max-w-lg">
        <EmptyState
          icon={UserCog}
          title="Commercial introuvable"
          description="Ce profil n'existe pas ou a été supprimé."
          action={
            <Button asChild>
              <Link to="/commerciaux">
                <ArrowLeft /> Retour à l'équipe
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
        <Link to="/commerciaux">
          <ArrowLeft /> Équipe commerciale
        </Link>
      </Button>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            Commercial · depuis le {fmtDate(user.dateRecrutement)}
          </span>
        }
        title={user.nom}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" /> {user.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" /> {user.telephone}
            </span>
            {user.actif ? (
              <StatusBadge tone="success">Actif</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Inactif</StatusBadge>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <UserAvatar nom={user.nom} avatar={user.avatar} className="hidden size-11 sm:flex" />
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil /> Modifier le compte
            </Button>
          </div>
        }
      />
      <CommercialPerformance data={data} user={user} mode="admin" />
      <UserFormDialog open={edit} onOpenChange={setEdit} user={user} />
    </div>
  );
}
