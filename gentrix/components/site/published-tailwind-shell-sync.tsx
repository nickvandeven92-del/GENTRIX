"use client";

import { useLayoutEffect } from "react";
import { publishedTailwindInlineHtmlShellAttrs } from "@/lib/site/studio-site-shell";

/**
 * Zet dezelfde `<html>`-dataset als bij iframe-srcDoc ook bij soft navigation (waar `beforeInteractive` niet opnieuw loopt).
 */
export function PublishedTailwindShellSync(opts: {
  publishedSlug?: string | null;
  navBrandLabel?: string | null;
}) {
  const syncKey = `${opts.publishedSlug ?? ""}|${opts.navBrandLabel ?? ""}`;
  useLayoutEffect(() => {
    const attrs = publishedTailwindInlineHtmlShellAttrs(opts);
    const html = document.documentElement;
    const previous = new Map<string, string | null>();
    for (const [k, v] of Object.entries(attrs)) {
      previous.set(k, html.getAttribute(k));
      html.setAttribute(k, v);
    }
    return () => {
      for (const [k, old] of previous) {
        if (old === null) html.removeAttribute(k);
        else html.setAttribute(k, old);
      }
    };
  }, [syncKey]);
  return null;
}
