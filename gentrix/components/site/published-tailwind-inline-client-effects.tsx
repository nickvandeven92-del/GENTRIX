"use client";

import { useLayoutEffect, useRef } from "react";

type WindowWithUiRuntimes = Window & {
  Alpine?: { destroyTree?: (n: Node) => void; initTree?: (n: Element) => void };
  lucide?: { createIcons?: () => void };
};

/**
 * Na App Router-soft navigatie draaien `<script>`-tags in `dangerouslySetInnerHTML` niet opnieuw.
 * Alpine + Lucide wel globaal; we initialiseren opnieuw op de nieuwe `.gentrix-published-root`-boom.
 */
export function PublishedTailwindInlineClientEffects({ bodyFingerprint }: { bodyFingerprint: string }) {
  const first = useRef(true);

  useLayoutEffect(() => {
    const root = document.querySelector("[data-gentrix-published-site-root]");
    if (!root) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const w = window as WindowWithUiRuntimes;
    try {
      w.Alpine?.destroyTree?.(root);
    } catch {
      /* ignore */
    }
    try {
      w.Alpine?.initTree?.(root);
    } catch {
      /* ignore */
    }
    try {
      w.lucide?.createIcons?.();
    } catch {
      /* ignore */
    }
  }, [bodyFingerprint]);

  return null;
}
