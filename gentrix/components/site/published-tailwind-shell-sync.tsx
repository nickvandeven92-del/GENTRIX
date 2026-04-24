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
    for (const [k, v] of Object.entries(attrs)) {
      html.setAttribute(k, v);
    }
    /** Geen restore op unmount: tussen App Router-soft navigaties (home → contact) viel
     * `data-gentrix-studio-iframe` kort weg → shell-CSS schakelde uit → zichtbare flits, vooral op Safari. */
  }, [syncKey]);
  return null;
}
