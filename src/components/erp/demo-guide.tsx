import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Presentation, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/erp/hooks";
import type { Role } from "@/lib/erp/types";

interface Step {
  id: string;
  title: string;
  tip: string;
  link: { label: string; to: string; search?: Record<string, unknown> };
  roles: Role[];
}

const both: Role[] = ["admin", "commercial"];

const STEPS: Step[] = [
  {
    id: "client",
    title: "Créer un client",
    tip: "Ajoutez un client (particulier, promoteur, architecte…) et son commercial responsable.",
    link: { label: "Nouveau client", to: "/clients", search: { nouveau: true } },
    roles: both,
  },
  {
    id: "devis",
    title: "Créer un devis pour ce client",
    tip: "Sélectionnez le client, la date de validité et les conditions.",
    link: { label: "Nouveau devis", to: "/devis/nouveau" },
    roles: both,
  },
  {
    id: "produits",
    title: "Ajouter des produits",
    tip: "Saisissez en m² : les cartons, pièces, remises, HT, TVA et TTC se calculent automatiquement.",
    link: { label: "Voir le catalogue", to: "/produits" },
    roles: both,
  },
  {
    id: "accepte",
    title: "Accepter le devis",
    tip: "Passez le statut du devis à « Accepté », puis imprimez-le ou téléchargez le PDF.",
    link: { label: "Liste des devis", to: "/devis" },
    roles: both,
  },
  {
    id: "commande",
    title: "Transformer le devis en commande",
    tip: "Un clic crée la commande et réserve automatiquement les cartons en stock.",
    link: { label: "Liste des devis", to: "/devis" },
    roles: both,
  },
  {
    id: "stock",
    title: "Constater la réservation du stock",
    tip: "Le stock disponible baisse, le stock physique reste intact jusqu'à la livraison.",
    link: { label: "Ouvrir les stocks", to: "/stocks" },
    roles: both,
  },
  {
    id: "livraison",
    title: "Préparer puis livrer la commande",
    tip: "Faites avancer les étapes jusqu'à « Livrée » : la sortie de stock est enregistrée une seule fois.",
    link: { label: "Commandes", to: "/commandes" },
    roles: ["admin"],
  },
  {
    id: "facture",
    title: "Générer la facture",
    tip: "Depuis la commande, générez la facture numérotée, imprimable et exportable en PDF.",
    link: { label: "Commandes", to: "/commandes" },
    roles: ["admin"],
  },
  {
    id: "paiement",
    title: "Enregistrer un paiement",
    tip: "Espèces, virement, chèque ou carte : paiement partiel ou total, le solde se met à jour.",
    link: { label: "Factures", to: "/factures" },
    roles: ["admin"],
  },
  {
    id: "stats",
    title: "Voir les statistiques actualisées",
    tip: "Tableau de bord, rapports et notifications reflètent immédiatement l'opération.",
    link: { label: "Tableau de bord", to: "/tableau-de-bord" },
    roles: both,
  },
];

const KEY = "erp-demo-guide";
const load = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/** Guide pas-à-pas pour présenter le parcours complet devis → paiement. */
export function DemoGuide() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => setDone(load()), []);
  const save = (v: string[]) => {
    setDone(v);
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      /* stockage indisponible */
    }
  };
  const steps = STEPS.filter((s) => s.roles.includes(user.role));
  const nb = steps.filter((s) => done.includes(s.id)).length;
  const toggle = (id: string) =>
    save(done.includes(id) ? done.filter((x) => x !== id) : [...done, id]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          aria-label="Guide de démonstration"
        >
          <Presentation />
          <span className="hidden xl:inline">Guide de démo</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle>Parcours de démonstration</SheetTitle>
          <SheetDescription>
            Du premier contact client jusqu'à l'encaissement, en {steps.length} étapes reliées entre
            elles.
          </SheetDescription>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={(nb / steps.length) * 100} className="h-2" />
            <span className="shrink-0 text-xs font-medium tabular text-muted-foreground">
              {nb} / {steps.length}
            </span>
          </div>
        </SheetHeader>
        <ol className="flex-1 space-y-2 overflow-y-auto p-4">
          {steps.map((s, i) => {
            const ok = done.includes(s.id);
            return (
              <li
                key={s.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  ok ? "border-success/30 bg-success-soft/40" : "bg-card",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-label={ok ? "Marquer comme non faite" : "Marquer comme faite"}
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular transition-colors",
                      ok
                        ? "border-success bg-success text-white"
                        : "text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                  >
                    {ok ? <Check className="size-3.5" /> : i + 1}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        ok && "text-muted-foreground line-through",
                      )}
                    >
                      {s.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.tip}</p>
                    <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                      <Link
                        to={s.link.to}
                        search={s.link.search as never}
                        onClick={() => setOpen(false)}
                      >
                        {s.link.label} <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center justify-between gap-2 border-t p-4 text-xs text-muted-foreground">
          <span>Astuce : basculez vers l'espace commercial depuis le menu utilisateur.</span>
          <Button variant="ghost" size="sm" onClick={() => save([])}>
            <RotateCcw /> Recommencer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
