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
    const track =
      section.querySelector<HTMLElement>("[data-social-gallery-track='1']") ??
      section.querySelector<HTMLElement>(".grid");
    if (!track) return;

    let prevBtn = section.querySelector<HTMLButtonElement>("[data-social-gallery-prev='1']");
    let nextBtn = section.querySelector<HTMLButtonElement>("[data-social-gallery-next='1']");
    if (!prevBtn || !nextBtn) {
      const titleRow =
        section.querySelector<HTMLElement>(".mb-6") ??
        section.querySelector<HTMLElement>("div");
      if (!titleRow) return;
      const controls = document.createElement("div");
      controls.className = "flex items-center gap-2";
      controls.innerHTML = `
        <button type="button" data-social-gallery-prev="1" aria-label="Vorige social posts" class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40"><span aria-hidden="true">←</span></button>
        <button type="button" data-social-gallery-next="1" aria-label="Volgende social posts" class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40"><span aria-hidden="true">→</span></button>
      `;
      titleRow.appendChild(controls);
      prevBtn = controls.querySelector<HTMLButtonElement>("[data-social-gallery-prev='1']");
      nextBtn = controls.querySelector<HTMLButtonElement>("[data-social-gallery-next='1']");
    }
    if (!prevBtn || !nextBtn) return;

    const cards = Array.from(track.children) as HTMLElement[];
    if (cards.length === 0) return;
    track.style.display = "grid";
    track.style.gridAutoFlow = "column";
    track.style.gridTemplateColumns = "none";
    track.style.gridAutoColumns = "calc((100% - 24px) / 3)";
    track.style.overflowX = "auto";
    track.style.overscrollBehaviorX = "contain";
    track.style.scrollSnapType = "x mandatory";
    track.style.scrollBehavior = "smooth";
    cards.forEach((card) => {
      card.style.scrollSnapAlign = "start";
    });

    const existingTimer = socialGalleryTimers.get(section);
    if (existingTimer != null) {
      window.clearInterval(existingTimer);
      socialGalleryTimers.delete(section);
    }

    const pageSize = 3;
    const maxPage = Math.max(0, Math.ceil(cards.length / pageSize) - 1);
    const pageWidth = () => track.clientWidth;
    const currentPage = () => {
      const width = pageWidth();
      if (width <= 0) return 0;
      return Math.max(0, Math.min(maxPage, Math.round(track.scrollLeft / width)));
    };
    const goToPage = (page: number) => {
      const safePage = Math.max(0, Math.min(maxPage, page));
      track.scrollTo({ left: safePage * pageWidth(), behavior: "smooth" });
    };
    const render = () => {
      const pageIndex = currentPage();
      prevBtn.disabled = pageIndex === 0;
      nextBtn.disabled = pageIndex >= maxPage;
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
      goToPage(currentPage() - 1);
    };
    nextBtn.onclick = () => {
      stopAutoPlay();
      goToPage(currentPage() + 1);
    };
    track.onscroll = () => render();

    render();
    if (maxPage > 0) {
      const timerId = window.setInterval(() => {
        const pageIndex = currentPage();
        const nextPage = pageIndex >= maxPage ? 0 : pageIndex + 1;
        goToPage(nextPage);
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
