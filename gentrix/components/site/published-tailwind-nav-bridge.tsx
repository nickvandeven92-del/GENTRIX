"use client";

import { useEffect, type ReactNode } from "react";
import { STUDIO_PUBLIC_NAV_MESSAGE_SOURCE } from "@/lib/site/studio-public-nav-message";

/**
 * Ontvangt navigatie uit de sandboxed marketing-iframe (srcDoc) wanneer scripts geen `top.location` mogen zetten.
 */
export function PublishedTailwindNavBridge({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      /* srcDoc-iframe zonder allow-same-origin: sommige browsers melden origin als de string "null". */
      if (ev.origin !== window.location.origin && ev.origin !== "null") return;
      const d = ev.data as { source?: string; href?: string };
      if (!d || d.source !== STUDIO_PUBLIC_NAV_MESSAGE_SOURCE || typeof d.href !== "string") return;
      try {
        const u = new URL(d.href);
        if (u.origin !== window.location.origin) return;
        window.location.assign(d.href);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return <>{children}</>;
}
