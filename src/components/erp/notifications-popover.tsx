import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/lib/erp/hooks";
import { useErp } from "@/lib/erp/store";
import { timeAgo } from "@/lib/erp/format";
import { cn } from "@/lib/utils";
import { NotifIcon } from "./notif-icon";

export function NotificationsPopover() {
  const { list, unread } = useNotifications();
  const markRead = useErp((s) => s.markRead);
  const markAllRead = useErp((s) => s.markAllRead);
  const navigate = useNavigate();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground tabular">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread} non lue(s)</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!unread}
            onClick={() => markAllRead(list.map((n) => n.id))}
          >
            <CheckCheck /> Tout marquer comme lu
          </Button>
        </div>
        <ScrollArea className="h-[360px]">
          <ul className="divide-y">
            {list.slice(0, 15).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    markRead(n.id);
                    if (n.lien) navigate({ to: n.lien });
                  }}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40",
                    !n.lu && "bg-primary-soft/40",
                  )}
                >
                  <NotifIcon niveau={n.niveau} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{n.titre}</p>
                      {!n.lu && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.date)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="border-t p-2">
          <Button asChild variant="ghost" className="w-full">
            <Link to="/notifications">Voir tout l'historique</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
