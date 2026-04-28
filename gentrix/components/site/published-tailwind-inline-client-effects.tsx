"use client";

import { useLayoutEffect, useRef } from "react";

type WindowWithUiRuntimes = Window & {
  Alpine?: { destroyTree?: (n: Node) => void; initTree?: (n: Element) => void };
  lucide?: { createIcons?: () => void };
};

const socialGalleryTimers = new WeakMap<Element, number>();

function initSocialGalleryCarousel(root: ParentNode) {
  const sections = root.querySelectorAll<HTMLElement>("[data-social-gallery-carousel='1']");
  sections.forEach((section) => {
    const track = section.querySelector<HTMLElement>("[data-social-gallery-track='1']");
    const prevBtn = section.querySelector<HTMLButtonElement>("[data-social-gallery-prev='1']");
    const nextBtn = section.querySelector<HTMLButtonElement>("[data-social-gallery-next='1']");
    if (!track || !prevBtn || !nextBtn) return;

    const cards = Array.from(track.children) as HTMLElement[];
    const pageSize = 3;
    let pageIndex = 0;
    const maxPage = Math.max(0, Math.ceil(cards.length / pageSize) - 1);

    const existingTimer = socialGalleryTimers.get(section);
    if (existingTimer != null) {
      window.clearInterval(existingTimer);
      socialGalleryTimers.delete(section);
    }

    const render = () => {
      cards.forEach((card, index) => {
        const cardPage = Math.floor(index / pageSize);
        card.style.display = cardPage === pageIndex ? "" : "none";
      });
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
      pageIndex = Math.max(0, pageIndex - 1);
      render();
    };
    nextBtn.onclick = () => {
      stopAutoPlay();
      pageIndex = Math.min(maxPage, pageIndex + 1);
      render();
    };

    render();
    if (maxPage > 0) {
      const timerId = window.setInterval(() => {
        pageIndex = pageIndex >= maxPage ? 0 : pageIndex + 1;
        render();
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
