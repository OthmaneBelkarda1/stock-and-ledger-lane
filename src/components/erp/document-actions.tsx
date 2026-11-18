import { useState, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, FileQuestion, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/erp/export";
import { EmptyState } from "./empty-state";

/** Boutons « Imprimer » et « Télécharger le PDF » d'un document (devis, bon de commande, facture). */
export function DocumentActions({
  targetRef,
  filename,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);
  const pdf = async () => {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(targetRef.current, filename);
      toast.success("Le PDF a été téléchargé.");
    } catch {
      toast.error("La génération du PDF a échoué. Veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer /> Imprimer
      </Button>
      <Button variant="outline" onClick={pdf} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />} PDF
      </Button>
    </>
  );
}

/** Document introuvable ou non accessible avec le profil connecté. */
export function DocNotFound({
  title,
  back,
}: {
  title: string;
  back: "/devis" | "/commandes" | "/factures";
}) {
  const labels = {
    "/devis": "Retour aux devis",
    "/commandes": "Retour aux commandes",
    "/factures": "Retour aux factures",
  } as const;
  return (
    <div className="card-surface mx-auto mt-6 max-w-lg">
      <EmptyState
        icon={FileQuestion}
        title={title}
        description="Ce document n'existe pas, a été supprimé ou n'est pas accessible avec votre profil."
        action={
          <Button asChild variant="outline">
            <Link to={back}>
              <ArrowLeft /> {labels[back]}
            </Link>
          </Button>
        }
      />
    </div>
  );
}

/** Lien de retour discret au-dessus des en-têtes de page. */
export function BackLink({
  to,
  label,
}: {
  to: "/devis" | "/commandes" | "/factures" | "/paiements";
  label: string;
}) {
  return (
    <Link
      to={to}
      className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> {label}
    </Link>
  );
}
