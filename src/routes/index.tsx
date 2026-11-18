import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import showroom from "@/assets/login-showroom.jpg";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyLogo, CompanyName } from "@/components/erp/company-brand";
import { useBootstrap } from "@/lib/erp/bootstrap";
import { useSession } from "@/lib/erp/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Connexion — Gestion commerciale céramique" },
      { name: "description", content: "Connectez-vous à votre espace de gestion : ventes, stocks, devis, commandes et facturation." },
      { property: "og:title", content: "Connexion — Gestion commerciale céramique" },
      { property: "og:description", content: "Accédez à votre espace administrateur ou commercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const DEMO = [
  { role: "Administrateur", email: "admin@demo.ma", password: "Admin123!", icon: ShieldCheck, desc: "Direction, finances, équipe, paramètres" },
  { role: "Commercial", email: "commercial@demo.ma", password: "Commercial123!", icon: UserRound, desc: "Clients, devis, commandes, objectifs" },
];

function LoginPage() {
  const ready = useBootstrap();
  const userId = useSession((s) => s.userId);
  const login = useSession((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && userId) navigate({ to: "/tableau-de-bord" });
  }, [ready, userId, navigate]);

  const submit = (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    if (!ready) return;
    setError(null);
    setLoading(true);
    const em = creds?.email ?? email;
    const pw = creds?.password ?? password;
    setTimeout(() => {
      const r = login(em, pw, remember);
      setLoading(false);
      if (!r.ok) setError(r.error);
      else toast.success("Connexion réussie. Bienvenue !");
    }, 450);
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <img src={showroom} alt="Showroom de carrelage grand format" width={1200} height={1600} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-primary/10" />
        <div className="relative flex h-full flex-col justify-between p-10 text-primary-foreground xl:p-14">
          <div className="flex items-center gap-3">
            <CompanyLogo variant="dark" />
            <CompanyName className="text-sm font-semibold tracking-wide" />
          </div>
          <div className="max-w-lg">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Céramique · Carrelage · Marbre</p>
            <h1 className="font-display text-5xl leading-[1.05] xl:text-6xl">Toute votre activité, pilotée depuis une seule plateforme.</h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-primary-foreground/80">
              Catalogue, stocks par lot et tonalité, devis, commandes, facturation et suivi des équipes commerciales — en temps réel, sur ordinateur, tablette et smartphone.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 border-t border-primary-foreground/20 pt-6 text-xs text-primary-foreground/75">
            <div>
              <p className="text-lg font-semibold text-primary-foreground">Ventes</p>Devis → commande → facture
            </div>
            <div>
              <p className="text-lg font-semibold text-primary-foreground">Stocks</p>Cartons, m², lots, dépôts
            </div>
            <div>
              <p className="text-lg font-semibold text-primary-foreground">Pilotage</p>Indicateurs & rapports
            </div>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px] fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <CompanyLogo />
            <CompanyName className="text-sm font-semibold" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Connexion</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accédez à votre espace de gestion.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="nom@entreprise.ma" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-card" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => toast.info("Contactez votre administrateur pour réinitialiser votre mot de passe.")}>
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 bg-card pr-11" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              Se souvenir de moi
            </label>
            {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={loading || !ready}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              Se connecter
            </Button>
          </form>

          <div className="mt-10">
            <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              Accès rapide — démonstration
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  disabled={!ready || loading}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                    submit(undefined, d);
                  }}
                  className="card-surface group flex items-start gap-3 p-3 text-left transition-all hover:border-primary/40 hover:shadow-elevated disabled:opacity-60"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <d.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {d.role} <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">{d.email}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{d.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              Version de démonstration : authentification simulée et données fictives. Une authentification sécurisée côté serveur sera mise en place en production.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
