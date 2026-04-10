"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type PortalNavProps = {
  slug: string;
  appointmentsEnabled: boolean;
  invoicesEnabled: boolean;
  accountEnabled: boolean;
};

export function PortalNav({
  slug,
  appointmentsEnabled,
  invoicesEnabled,
  accountEnabled,
}: PortalNavProps) {
  const pathname = usePathname();
  const enc = encodeURIComponent(slug);
  const base = `/portal/${enc}`;

  const items: { href: string; label: string }[] = [
    { href: base, label: "Dashboard" },
    ...(invoicesEnabled ? [{ href: `${base}/facturen`, label: "Facturen" }] : []),
    ...(appointmentsEnabled
      ? [
          { href: `${base}/afspraken`, label: "Afspraken" },
          { href: `${base}/behandelingen`, label: "Behandelingen" },
          { href: `${base}/medewerkers`, label: "Medewerkers" },
          { href: `${base}/planning`, label: "Planning" },
        ]
      : []),
    ...(accountEnabled ? [{ href: `${base}/account`, label: "Account" }] : []),
  ];

  return (
    <nav
      className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Portaal"
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {items.map(({ href, label }) => {
          const active =
            href === base ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
                active
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
