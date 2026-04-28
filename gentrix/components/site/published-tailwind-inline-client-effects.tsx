"use client";

import { useLayoutEffect, useRef } from "react";

type WindowWithUiRuntimes = Window & {
  Alpine?: { destroyTree?: (n: Node) => void; initTree?: (n: Element) => void };
  lucide?: { createIcons?: () => void };
};

const socialGalleryTimers = new WeakMap<Element, number>();

function initSocialGalleryCarousel(root: ParentNode) {
  const sections = Array.from(
    root.querySelectorAll<HTMLElement>("[data-social-gallery-carousel='1'], #social-gallery-placeholder"),
  );
  sections.forEach((section) => {
    section.querySelectorAll("h2").forEach((heading) => heading.remove());
    const track =
      section.querySelector<HTMLElement>("[data-social-gallery-track='1']") ??
      section.querySelector<HTMLElement>(".grid");
    if (!track) return;

    let prevBtn = section.querySelector<HTMLButtonElement>("[data-social-gallery-prev='1']");
    let nextBtn = section.querySelector<HTMLButtonElement>("[data-social-gallery-next='1']");
    if (!prevBtn || !nextBtn) {
      const titleRow =
        section.querySelector<HTMLElement>(".relative") ??
        section.querySelector<HTMLElement>("div");
      if (!titleRow) return;
      const controls = document.createElement("div");
      controls.className = "";
      controls.innerHTML = `
        <button type="button" data-social-gallery-prev="1" aria-label="Vorige social posts" class="absolute left-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border disabled:opacity-40" style="border-color:var(--site-border, var(--site-fg, #d4d4d8)); color:var(--site-foreground, var(--site-fg, #111827)); background:var(--site-surface, var(--site-bg, #ffffff));"><span aria-hidden="true">←</span></button>
        <button type="button" data-social-gallery-next="1" aria-label="Volgende social posts" class="absolute right-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border disabled:opacity-40" style="border-color:var(--site-border, var(--site-fg, #d4d4d8)); color:var(--site-foreground, var(--site-fg, #111827)); background:var(--site-surface, var(--site-bg, #ffffff));"><span aria-hidden="true">→</span></button>
      `;
      titleRow.appendChild(controls);
      prevBtn = controls.querySelector<HTMLButtonElement>("[data-social-gallery-prev='1']");
      nextBtn = controls.querySelector<HTMLButtonElement>("[data-social-gallery-next='1']");
    }
    if (!prevBtn || !nextBtn) return;
    section.querySelectorAll("[data-social-gallery-prev='1']").forEach((btn, index) => {
      if (index > 0) btn.remove();
    });
    section.querySelectorAll("[data-social-gallery-next='1']").forEach((btn, index) => {
      if (index > 0) btn.remove();
    });

    const cards = Array.from(track.children) as HTMLElement[];
    if (cards.length === 0) return;
    track.style.display = "grid";
    track.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
    track.style.overflowX = "hidden";
    track.style.scrollBehavior = "auto";
    track.style.gridAutoFlow = "";
    track.style.gridAutoColumns = "";
    track.style.overscrollBehaviorX = "";
    track.style.scrollSnapType = "";
    cards.forEach((card) => {
      card.style.scrollSnapAlign = "";
    });

    const existingTimer = socialGalleryTimers.get(section);
    if (existingTimer != null) {
      window.clearInterval(existingTimer);
      socialGalleryTimers.delete(section);
    }

    const visibleCount = 3;
    const maxStartIndex = Math.max(0, cards.length - visibleCount);
    let startIndex = 0;
    const goToIndex = (nextStart: number) => {
      startIndex = Math.max(0, Math.min(maxStartIndex, nextStart));
      render();
    };
    const render = () => {
      cards.forEach((card, index) => {
        card.style.display = index >= startIndex && index < startIndex + visibleCount ? "" : "none";
      });
      prevBtn.disabled = startIndex === 0;
      nextBtn.disabled = startIndex >= maxStartIndex;
    };

    const stopAutoPlay = () => {
      const timerId = socialGalleryTimers.get(section);
      if (timerId != null) {
        window.clearInterval(timerId);
        socialGalleryTimers.delete(section);
      }
    };

    prevBtn.onclick = () => {
      stopAutoPlay();
      goToIndex(startIndex - 1);
    };
    nextBtn.onclick = () => {
      stopAutoPlay();
      goToIndex(startIndex + 1);
    };

    render();
    if (maxStartIndex > 0) {
      const timerId = window.setInterval(() => {
        const nextStart = startIndex >= maxStartIndex ? 0 : startIndex + 1;
        goToIndex(nextStart);
      }, 10_000);
      socialGalleryTimers.set(section, timerId);
    }
  });
}

/**
 * Na App Router-soft navigatie draaien `<script>`-tags in `dangerouslySetInnerHTML` niet opnieuw.
 * Alpine + Lucide wel globaal; we initialiseren opnieuw op de nieuwe `.gentrix-published-root`-boom.
 */
export function PublishedTailwindInlineClientEffects({ bodyFingerprint }: { bodyFingerprint: string }) {
  const first = useRef(true);

  useLayoutEffect(() => {
    const root = document.querySelector("[data-gentrix-published-site-root]");
    if (!root) return;
    initSocialGalleryCarousel(root);
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

    initSocialGalleryCarousel(root);
  }, [bodyFingerprint]);

  return null;
}
