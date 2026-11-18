import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/erp/constants";

export const toneVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-secondary text-secondary-foreground",
        info: "bg-info-soft text-info",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning-foreground",
        danger: "bg-destructive-soft text-destructive",
        primary: "bg-primary-soft text-primary",
        sand: "bg-accent text-sand-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const dot: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  primary: "bg-primary",
  sand: "bg-sand-foreground",
};

export function StatusBadge({
  tone,
  children,
  className,
  withDot = true,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
  withDot?: boolean;
}) {
  return (
    <span className={cn(toneVariants({ tone }), className)}>
      {withDot && <span className={cn("size-1.5 rounded-full", dot[tone])} />}
      {children}
    </span>
  );
}
