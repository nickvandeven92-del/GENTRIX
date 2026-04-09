import { ChevronDown } from "lucide-react";
import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { cn } from "@/lib/utils";
import type { ResolveHref } from "./types";

type NavSection = Extract<ReactSiteSection, { type: "nav_overlay" }>;
type NavItem = NavSection["props"]["links"][number];

export type CinematicNavVariant = "floating" | "bar_light" | "bar_dark";

const summaryBase =
  "flex cursor-pointer list-none items-center gap-1 rounded-md outline-none transition select-none [&::-webkit-details-marker]:hidden";

function submenuPanelClass(variant: CinematicNavVariant): string {
  if (variant === "bar_light") {
    return cn(
      "absolute left-1/2 top-full z-[60] mt-2 min-w-[12rem] max-w-[min(100vw-2rem,16rem)] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl sm:left-0 sm:translate-x-0",
      "max-h-72 overflow-y-auto overscroll-contain",
    );
  }
  if (variant === "bar_dark") {
    return cn(
      "absolute left-1/2 top-full z-[60] mt-2 min-w-[12rem] max-w-[min(100vw-2rem,16rem)] -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900 py-1.5 shadow-xl sm:left-0 sm:translate-x-0",
      "max-h-72 overflow-y-auto overscroll-contain",
    );
  }
  return cn(
    "absolute left-1/2 top-full z-[60] mt-2 min-w-[12rem] max-w-[min(100vw-2rem,16rem)] -translate-x-1/2 rounded-xl border border-white/20 bg-zinc-950/95 py-1.5 shadow-xl backdrop-blur-md sm:left-0 sm:translate-x-0",
    "max-h-72 overflow-y-auto overscroll-contain",
  );
}

function submenuLinkClass(variant: CinematicNavVariant): string {
  if (variant === "bar_light") {
    return "block px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900";
  }
  if (variant === "bar_dark") {
    return "block px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/10 hover:text-white";
  }
  return "block px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/10 hover:text-white";
}

function summaryClass(variant: CinematicNavVariant): string {
  if (variant === "bar_light") {
    return cn(summaryBase, "text-zinc-600 hover:text-zinc-900");
  }
  if (variant === "bar_dark") {
    return cn(summaryBase, "text-zinc-300 hover:text-white");
  }
  return cn(summaryBase, "text-white/90 hover:text-white");
}

function flatLinkClass(variant: CinematicNavVariant, textSize: string): string {
  if (variant === "bar_light") {
    return cn(textSize, "font-medium text-zinc-600 transition hover:text-zinc-900");
  }
  if (variant === "bar_dark") {
    return cn(textSize, "font-medium text-zinc-300 transition hover:text-white");
  }
  return cn(textSize, "font-medium text-white/90 transition hover:text-white");
}

export function CinematicNavMenuEntries({
  items,
  resolveHref,
  variant,
  textSizeClass = "text-[0.9375rem] sm:text-sm",
}: {
  items: NavSection["props"]["links"];
  resolveHref: ResolveHref;
  variant: CinematicNavVariant;
  textSizeClass?: string;
}) {
  return (
    <>
      {items.map((item, index) => {
        const key = `${item.label}-${index}`;
        const hasChildren = item.children != null && item.children.length > 0;

        if (!hasChildren) {
          return (
            <a key={key} href={resolveHref(item.href!)} className={flatLinkClass(variant, textSizeClass)}>
              {item.label}
            </a>
          );
        }

        return (
          <details key={key} className="group relative">
            <summary className={summaryClass(variant)}>
              <span className={textSizeClass}>{item.label}</span>
              <ChevronDown
                className="size-4 shrink-0 opacity-70 transition duration-200 group-open:rotate-180"
                aria-hidden
                strokeWidth={2}
              />
            </summary>
            <ul className={submenuPanelClass(variant)} role="list">
              {item.children!.map((c) => (
                <li key={c.href + c.label}>
                  <a href={resolveHref(c.href)} className={submenuLinkClass(variant)}>
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}
