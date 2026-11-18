import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentUser, useNotifications } from "@/lib/erp/hooks";
import { ROLE_LABELS } from "@/lib/erp/permissions";
import { CompanyLogo, CompanyName } from "./company-brand";
import { navFor } from "./nav";

export function AppSidebar() {
  const user = useCurrentUser();
  const { unread } = useNotifications();
  const { setOpenMobile, isMobile } = useSidebar();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const groups = navFor(user.role);
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-1 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <CompanyLogo variant="dark" className="group-data-[collapsible=icon]:size-8" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <CompanyName className="block truncate text-sm font-semibold text-sidebar-accent-foreground" />
            <span className="block truncate text-[11px] text-sidebar-muted">Espace {ROLE_LABELS[user.role].toLowerCase()}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-sidebar-muted">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium"
                    >
                      <Link to={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.url === "/notifications" && unread > 0 && (
                      <SidebarMenuBadge className="bg-sidebar-accent text-sidebar-accent-foreground">{unread}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <p className="px-2 py-1 text-[11px] leading-snug text-sidebar-muted group-data-[collapsible=icon]:hidden">
          Version de démonstration — données fictives
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
