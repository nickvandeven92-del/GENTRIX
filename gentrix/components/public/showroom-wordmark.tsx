import { Cpu } from "lucide-react";
import { PUBLIC_BRAND } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ShowroomWordmarkProps = {
  className?: string;
  /** Kleinere typografie (bijv. vaste onderbalk). */
  compact?: boolean;
  /**
   * `showroom` = donkere landingspagina (licht woordmerk).
   * `onLight` = lichte chrome (concept-actiebalk, dashboard-achtig).
   */
  variant?: "showroom" | "onLight";
};

/**
 * Zelfde merkmark als de showroom-header: Cpu-icoon + {@link PUBLIC_BRAND}.
 */
export function ShowroomWordmark({ className, compact, variant = "showroom" }: ShowroomWordmarkProps) {
  const onLight = variant === "onLight";
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 font-medium tracking-[0.2em]",
        compact ? "text-xs tracking-[0.16em]" : "text-sm",
        onLight ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-100",
        className,
      )}
    >
      <Cpu
        className={cn(
          "shrink-0",
          compact ? "size-3.5" : "size-4",
          onLight ? "text-cyan-600 dark:text-cyan-400/90" : "text-cyan-400/90",
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate uppercase">{PUBLIC_BRAND}</span>
    </span>
  );
}
