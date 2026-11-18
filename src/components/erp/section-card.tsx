import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({ title, description, action, children, className, bodyClassName }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("card-surface fade-up flex flex-col", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3.5 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("flex-1 p-4 md:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
