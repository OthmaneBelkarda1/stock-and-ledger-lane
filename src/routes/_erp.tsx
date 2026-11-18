import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/erp/app-sidebar";
import { MobileNav } from "@/components/erp/mobile-nav";
import { Topbar } from "@/components/erp/topbar";
import { useBootstrap } from "@/lib/erp/bootstrap";
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
            <Outlet />
          </main>
        </SidebarInset>
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}
