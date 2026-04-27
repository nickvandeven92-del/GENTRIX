"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

/**
 * Post-hydration chunks: minder parse/eval op kritieke pad (FCP).
 * `ssr: false` mag alleen in een Client Component (Next 16).
 */
const NavigationProgress = dynamic(
  () => import("@/components/navigation-progress").then((m) => m.NavigationProgress),
  { ssr: false },
);
const PortalPwaRoot = dynamic(
  () => import("@/components/portal/portal-pwa-root").then((m) => m.PortalPwaRoot),
  { ssr: false },
);

export function RootClientIslands({ children }: { children: ReactNode }) {
  return (
    <>
      <NavigationProgress />
      {children}
      <PortalPwaRoot />
    </>
  );
}
