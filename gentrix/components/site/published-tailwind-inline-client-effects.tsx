"use client";

import { useLayoutEffect, useRef } from "react";

type WindowWithUiRuntimes = Window & {
  Alpine?: { destroyTree?: (n: Node) => void; initTree?: (n: Element) => void };
  lucide?: { createIcons?: () => void };
};

const socialGalleryTimers = new WeakMap<Element, number>();

function initSocialGalleryCarousel(root: ParentNode) {
  const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-social-gallery-carousel='1']"));
  sections.forEach((section) => {
    const heading = section.querySelector("h2");
    if (heading) heading.remove();

    let track = section.querySelector<HTMLElement>("[data-social-gallery-track='1']");
    if (!track) {
      const candidateTracks = Array.from(section.querySelectorAll<HTMLElement>(".grid")).filter((node) => {
        const children = Array.from(node.children) as HTMLElement[];
        if (children.length < 3) return false;
        return children.every((child) => {
          const className = child.className ?? "";
          return className.includes("aspect-square") || className.includes("group");
        });
      });
      track = candidateTracks[0] ?? null;
      if (track) track.setAttribute("data-social-gallery-track", "1");
    }
    if (!track) return;
    section
      .querySelectorAll(
        "[data-social-gallery-prev='1'], [data-social-gallery-next='1'], button[aria-label='Vorige social posts'], button[aria-label='Volgende social posts']",
      )
      .forEach((btn) => btn.remove());

    let viewport = section.querySelector<HTMLElement>("[data-social-gallery-viewport='1']");
    if (!viewport) {
      viewport = document.createElement("div");
      viewport.setAttribute("data-social-gallery-viewport", "1");
      viewport.className = "relative px-10";
      track.parentElement?.insertBefore(viewport, track);
      viewport.appendChild(track);
    }

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.setAttribute("data-social-gallery-prev", "1");
    prevBtn.setAttribute("aria-label", "Vorige social posts");
    prevBtn.className = "absolute left-0 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border disabled:opacity-40";
    prevBtn.style.borderColor = "var(--site-border, var(--site-fg, #d4d4d8))";
    prevBtn.style.color = "var(--site-foreground, var(--site-fg, #111827))";
    prevBtn.style.background = "var(--site-surface, var(--site-bg, #ffffff))";
    prevBtn.innerHTML = "<span aria-hidden='true'>←</span>";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.setAttribute("data-social-gallery-next", "1");
    nextBtn.setAttribute("aria-label", "Volgende social posts");
    nextBtn.className = "absolute right-0 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border disabled:opacity-40";
    nextBtn.style.borderColor = "var(--site-border, var(--site-fg, #d4d4d8))";
    nextBtn.style.color = "var(--site-foreground, var(--site-fg, #111827))";
    nextBtn.style.background = "var(--site-surface, var(--site-bg, #ffffff))";
    nextBtn.innerHTML = "<span aria-hidden='true'>→</span>";
    viewport.appendChild(prevBtn);
    viewport.appendChild(nextBtn);

    const cards = Array.from(track.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
      .slice(0, 9);
    if (cards.length === 0) return;
    const mobileMedia = window.matchMedia("(max-width: 639px)");
    const visibleCount = () => (mobileMedia.matches ? 1 : 3);
    const applyTrackColumns = () => {
      track.style.gridTemplateColumns = `repeat(${visibleCount()}, minmax(0, 1fr))`;
    };
    track.style.display = "grid";
    applyTrackColumns();
    track.style.gap = "12px";
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

    const maxStartIndex = () => Math.max(0, cards.length - visibleCount());
    let startIndex = 0;
    const goToIndex = (nextStart: number) => {
      startIndex = Math.max(0, Math.min(maxStartIndex(), nextStart));
      render();
    };
    const render = () => {
      applyTrackColumns();
      const slots = visibleCount();
      cards.forEach((card, index) => {
        card.style.display = index >= startIndex && index < startIndex + slots ? "" : "none";
      });
      prevBtn.disabled = startIndex === 0;
      nextBtn.disabled = startIndex >= maxStartIndex();
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
    if (maxStartIndex() > 0) {
      const timerId = window.setInterval(() => {
        const currentMax = maxStartIndex();
        const nextStart = startIndex >= currentMax ? 0 : startIndex + 1;
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
