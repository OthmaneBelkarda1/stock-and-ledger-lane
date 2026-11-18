import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AccessDenied } from "@/components/erp/access-denied";
import { AppSidebar } from "@/components/erp/app-sidebar";
import { rolesForPath } from "@/components/erp/nav";
import { MobileNav } from "@/components/erp/mobile-nav";
import { Topbar } from "@/components/erp/topbar";
import { useBootstrap } from "@/lib/erp/bootstrap";
import { useCurrentUser } from "@/lib/erp/hooks";
import { useSession } from "@/lib/erp/session";

export const Route = createFileRoute("/_erp")({
  component: ErpLayout,
});

function ErpLayout() {
  const ready = useBootstrap();
  const userId = useSession((s) => s.userId);
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !userId) navigate({ to: "/" });
  }, [ready, userId, navigate]);

  const path = useRouterState({ select: (r) => r.location.pathname });

  if (!ready || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="ml-2 text-sm">Chargement de votre espace…</span>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <Topbar />
          <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-5 pb-28 sm:px-4 md:px-6 md:py-7 md:pb-10 lg:px-8">
            <Guard path={path} />
          </main>
        </SidebarInset>
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}

/** Contrôle d'accès par rôle (simulation frontend — à appliquer côté API en production). */
function Guard({ path }: { path: string }) {
  const user = useCurrentUser();
  if (!rolesForPath(path).includes(user.role)) return <AccessDenied />;
  return <Outlet key={user.id} />;
}
