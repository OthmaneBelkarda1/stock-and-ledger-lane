import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  ImagePlus,
  KeyRound,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CompanyLogo } from "@/components/erp/company-brand";
import { ConfirmDialog } from "@/components/erp/confirm-dialog";
import { PageHeader } from "@/components/erp/page-header";
import { SectionCard } from "@/components/erp/section-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { UserAvatar } from "@/components/erp/user-menu";
import { fmtDate } from "@/lib/erp/format";
import { pageHead } from "@/lib/erp/head";
import { useCurrentUser, useData } from "@/lib/erp/hooks";
import { ROLE_LABELS } from "@/lib/erp/permissions";
import { tryAction, useErp } from "@/lib/erp/store";
import type { Settings } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_erp/parametres")({
  head: pageHead(
    "Paramètres",
    "Identité de l'entreprise, facturation, numérotation, utilisateurs et démonstration.",
  ),
  component: ParametresPage,
});

function ParametresPage() {
  const [tab, setTab] = useState("entreprise");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Paramètres"
        description="Personnalisez l'application aux couleurs de votre entreprise."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
            <TabsTrigger value="ventes">Ventes & facturation</TabsTrigger>
            <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
            <TabsTrigger value="demo">Démonstration</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="entreprise" className="mt-4">
          <EntrepriseTab />
        </TabsContent>
        <TabsContent value="ventes" className="mt-4">
          <VentesTab />
        </TabsContent>
        <TabsContent value="utilisateurs" className="mt-4">
          <UtilisateursTab />
        </TabsContent>
        <TabsContent value="demo" className="mt-4">
          <DemoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Entreprise ---------------- */

type Societe = Settings["societe"];
const CHAMPS: { k: keyof Societe; label: string; placeholder?: string; full?: boolean }[] = [
  { k: "nom", label: "Nom de la société", placeholder: "Raison sociale" },
  { k: "slogan", label: "Slogan / activité", placeholder: "Céramique, carrelage et marbre" },
  { k: "adresse", label: "Adresse", full: true },
  { k: "ville", label: "Ville" },
  { k: "telephone", label: "Téléphone" },
  { k: "email", label: "Adresse e-mail" },
  { k: "siteWeb", label: "Site web" },
  { k: "ice", label: "ICE" },
  { k: "rc", label: "Registre de commerce (RC)" },
  { k: "if", label: "Identifiant fiscal (IF)" },
  { k: "patente", label: "Patente" },
  { k: "banque", label: "Banque" },
  { k: "rib", label: "RIB" },
];

const resizeLogo = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 320;
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

function EntrepriseTab() {
  const societe = useData().settings.societe;
  const updateSociete = useErp((s) => s.updateSociete);
  const [f, setF] = useState<Societe>({ ...societe });
  const [err, setErr] = useState<Partial<Record<keyof Societe, string>>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image (PNG, JPG, SVG…).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 4 Mo.");
      return;
    }
    try {
      const logo = await resizeLogo(file);
      setF((x) => ({ ...x, logo }));
      updateSociete({ logo });
      toast.success("Logo mis à jour.");
    } catch {
      toast.error("Impossible de lire cette image.");
    }
  };

  const save = () => {
    const e: Partial<Record<keyof Societe, string>> = {};
    if (!f.nom.trim()) e.nom = "Le nom de la société est obligatoire.";
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
      e.email = "Adresse e-mail invalide.";
    if (f.ice && !/^\d{15}$/.test(f.ice.replace(/\s/g, ""))) e.ice = "L'ICE comporte 15 chiffres.";
    setErr(e);
    if (Object.keys(e).length) {
      toast.error("Veuillez corriger les champs signalés.");
      return;
    }
    const r = tryAction(() => updateSociete({ ...f, nom: f.nom.trim() }));
    if (r.ok) toast.success("Informations de l'entreprise enregistrées.");
    else toast.error(r.error);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <SectionCard
        title="Logo"
        description="Affiché dans le menu, la page de connexion et les documents."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-32 items-center justify-center rounded-2xl border bg-muted/40 p-3">
            <CompanyLogo className="size-24 [&_svg]:size-8" />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onLogo(e.target.files?.[0])}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus /> {societe.logo ? "Remplacer" : "Importer un logo"}
            </Button>
            {societe.logo && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  updateSociete({ logo: undefined });
                  setF((x) => ({ ...x, logo: undefined }));
                  toast.success("Logo supprimé.");
                }}
              >
                <Trash2 /> Supprimer
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG ou SVG sur fond transparent recommandé · 4 Mo maximum.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            Identité de l'entreprise
          </span>
        }
        description="Ces informations apparaissent sur les devis, bons de commande et factures."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS.map((c) => (
            <div key={c.k} className={cn("space-y-1.5", c.full && "sm:col-span-2")}>
              <Label htmlFor={`soc-${c.k}`}>{c.label}</Label>
              <Input
                id={`soc-${c.k}`}
                className={cn("h-10 bg-card", err[c.k] && "border-destructive")}
                value={(f[c.k] as string | undefined) ?? ""}
                placeholder={c.placeholder}
                onChange={(e) => setF({ ...f, [c.k]: e.target.value })}
              />
              {err[c.k] && <p className="text-xs text-destructive">{err[c.k]}</p>}
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save}>
            <Save /> Enregistrer
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------------- Ventes & facturation ---------------- */

function VentesTab() {
  const st = useData().settings;
  const updateSettings = useErp((s) => s.updateSettings);
  const [f, setF] = useState({
    tauxTVA: st.tauxTVA,
    remiseMax: st.remiseMax,
    validiteDevisJours: st.validiteDevisJours,
    conditionsPaiement: st.conditionsPaiement,
    prefixes: { ...st.prefixes },
  });
  const [errors, setErrors] = useState<string[]>([]);
  const annee = new Date().getFullYear();
  const prochain = (k: keyof Settings["prefixes"]) =>
    `${f.prefixes[k] || "?"}-${annee}-${String(st.compteurs[k] + 1).padStart(4, "0")}`;

  const save = () => {
    const e: string[] = [];
    if (f.tauxTVA < 0 || f.tauxTVA > 30)
      e.push("Le taux de TVA doit être compris entre 0 et 30 %.");
    if (f.remiseMax < 0 || f.remiseMax > 100)
      e.push("La remise maximale doit être comprise entre 0 et 100 %.");
    if (f.validiteDevisJours < 1 || f.validiteDevisJours > 365)
      e.push("La validité des devis doit être comprise entre 1 et 365 jours.");
    for (const [k, v] of Object.entries(f.prefixes))
      if (!/^[A-Z0-9]{1,6}$/.test(v))
        e.push(`Le préfixe « ${k} » doit contenir 1 à 6 lettres majuscules ou chiffres.`);
    setErrors(e);
    if (e.length) return;
    const r = tryAction(() =>
      updateSettings({
        tauxTVA: f.tauxTVA,
        remiseMax: f.remiseMax,
        validiteDevisJours: f.validiteDevisJours,
        conditionsPaiement: f.conditionsPaiement.trim(),
        prefixes: f.prefixes,
      }),
    );
    if (r.ok) toast.success("Paramètres commerciaux enregistrés.");
    else toast.error(r.error);
  };

  const num = (
    k: "tauxTVA" | "remiseMax" | "validiteDevisJours",
    label: string,
    suffix: string,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          min={0}
          className="h-10 bg-card pr-12 tabular"
          value={f[k]}
          onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard
        title="Règles commerciales"
        description="Valeurs proposées par défaut lors de la création des documents."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {num("tauxTVA", "TVA par défaut", "%")}
          {num("remiseMax", "Remise maximale", "%")}
          {num("validiteDevisJours", "Validité des devis", "jours")}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label>Conditions de paiement (factures)</Label>
          <Textarea
            rows={3}
            className="bg-card"
            value={f.conditionsPaiement}
            onChange={(e) => setF({ ...f, conditionsPaiement: e.target.value })}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Devise : dirham marocain (MAD / DH) · Pays : Maroc · Dates au format JJ/MM/AAAA.
        </p>
      </SectionCard>

      <SectionCard
        title="Numérotation des documents"
        description="Préfixes utilisés pour générer automatiquement les numéros."
      >
        <div className="space-y-3">
          {(
            [
              ["devis", "Devis"],
              ["commande", "Commandes"],
              ["facture", "Factures"],
              ["paiement", "Paiements"],
            ] as const
          ).map(([k, label]) => (
            <div
              key={k}
              className="grid grid-cols-[1fr_110px] items-center gap-3 sm:grid-cols-[140px_110px_1fr]"
            >
              <Label className="col-span-2 sm:col-span-1">{label}</Label>
              <Input
                className="h-10 bg-card uppercase"
                maxLength={6}
                value={f.prefixes[k]}
                onChange={(e) =>
                  setF({ ...f, prefixes: { ...f.prefixes, [k]: e.target.value.toUpperCase() } })
                }
              />
              <p className="text-xs text-muted-foreground">
                Prochain : <b className="font-medium text-foreground tabular">{prochain(k)}</b>
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="xl:col-span-2">
        {errors.length > 0 && (
          <ul className="mb-3 space-y-1 rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button onClick={save}>
            <Save /> Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Utilisateurs ---------------- */

function UtilisateursTab() {
  const data = useData();
  const me = useCurrentUser();
  const toggleUser = useErp((s) => s.toggleUser);
  return (
    <SectionCard
      title="Comptes utilisateurs"
      description={`${data.users.length} comptes · ${data.users.filter((u) => u.actif).length} actifs`}
      bodyClassName="p-0"
    >
      <ul className="divide-y">
        {data.users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
            <UserAvatar nom={u.nom} avatar={u.avatar} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {u.nom}
                {u.id === me.id && (
                  <StatusBadge tone="neutral" withDot={false} className="text-[10px]">
                    Vous
                  </StatusBadge>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {u.email} · depuis le {fmtDate(u.dateRecrutement)}
              </p>
            </div>
            <StatusBadge tone={u.role === "admin" ? "primary" : "sand"} withDot={false}>
              {u.role === "admin" ? (
                <ShieldCheck className="size-3" />
              ) : (
                <UserRound className="size-3" />
              )}
              {ROLE_LABELS[u.role]}
            </StatusBadge>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={u.actif}
                disabled={u.id === me.id}
                onCheckedChange={() => {
                  const r = tryAction(() => toggleUser(u.id));
                  if (r.ok) toast.success(`Compte ${u.actif ? "désactivé" : "activé"} : ${u.nom}.`);
                  else toast.error(r.error);
                }}
                aria-label={u.actif ? "Désactiver le compte" : "Activer le compte"}
              />
              <span className="w-12">{u.actif ? "Actif" : "Inactif"}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-3 text-xs text-muted-foreground md:px-5">
        Un compte désactivé ne peut plus se connecter. Les objectifs et profils des commerciaux se
        gèrent depuis le module Commerciaux.
      </p>
    </SectionCard>
  );
}

/* ---------------- Démonstration ---------------- */

function DemoTab() {
  const resetDemo = useErp((s) => s.resetDemo);
  const [confirm, setConfirm] = useState(false);
  const comptes = [
    {
      role: "Administrateur",
      email: "admin@demo.ma",
      mdp: "Admin123!",
      desc: "Accès complet : finances, équipe, rapports, paramètres.",
    },
    {
      role: "Commercial",
      email: "commercial@demo.ma",
      mdp: "Commercial123!",
      desc: "Ses clients, devis, commandes, factures et performances.",
    },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            Comptes de démonstration
          </span>
        }
      >
        <div className="space-y-3">
          {comptes.map((c) => (
            <div key={c.email} className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">{c.role}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
              <dl className="mt-2 grid grid-cols-[90px_1fr] gap-y-0.5 text-xs">
                <dt className="text-muted-foreground">Identifiant</dt>
                <dd className="font-medium tabular">{c.email}</dd>
                <dt className="text-muted-foreground">Mot de passe</dt>
                <dd className="font-medium tabular">{c.mdp}</dd>
              </dl>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <RotateCcw className="size-4 text-muted-foreground" />
            Réinitialiser les données
          </span>
        }
      >
        <p className="text-sm text-muted-foreground">
          Les données de démonstration (produits, clients, devis, commandes, factures, paiements,
          stocks) sont enregistrées dans ce navigateur. Réinitialisez-les pour repartir d'un jeu de
          données propre avant une présentation.
        </p>
        <Button variant="destructive" className="mt-5" onClick={() => setConfirm(true)}>
          <RotateCcw /> Réinitialiser la démonstration
        </Button>
      </SectionCard>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Réinitialiser la démonstration ?"
        description="Toutes les modifications effectuées (clients, devis, commandes, paiements, paramètres…) seront remplacées par les données initiales."
        confirmLabel="Réinitialiser"
        destructive
        onConfirm={() => {
          resetDemo();
          toast.success("Les données de démonstration ont été réinitialisées.");
        }}
      />
    </div>
  );
}
