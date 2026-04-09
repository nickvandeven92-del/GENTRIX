import type { CSSProperties } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const siteButtonVariants = cva(
  "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "text-white shadow-md hover:opacity-95 focus-visible:ring-zinc-400",
        secondary:
          "border-2 border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 focus-visible:ring-zinc-400 dark:border-white/30 dark:bg-transparent dark:text-white dark:hover:bg-white/10",
        outline:
          "border border-zinc-300 bg-transparent text-zinc-900 hover:bg-zinc-100 focus-visible:ring-zinc-400 dark:border-white/35 dark:text-white dark:hover:bg-white/10",
        ghost: "text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-white/10",
      },
      size: {
        sm: "min-h-9 rounded-lg px-4 text-xs",
        md: "min-h-12 px-6 text-sm",
        lg: "min-h-14 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type SiteButtonVariantProps = VariantProps<typeof siteButtonVariants>;

export function siteButtonStyleAccent(accentVar: string): CSSProperties {
  return { backgroundColor: `var(${accentVar})` };
}

export function mergeButtonClass(
  variant: SiteButtonVariantProps["variant"],
  size: SiteButtonVariantProps["size"],
  className?: string,
) {
  return cn(siteButtonVariants({ variant: variant ?? "primary", size: size ?? "md" }), className);
}
