"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SocialGalleryItem } from "@/lib/social/social-gallery";

type Props = {
  items?: SocialGalleryItem[];
  layout?: "carousel" | "grid";
};

function useVisibleSlots(): 1 | 3 {
  const [slots, setSlots] = useState<1 | 3>(3);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setSlots(media.matches ? 1 : 3);
    sync();
    const onChange = () => sync();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return slots;
}

export function SocialGalleryLandingSection({ items = [], layout = "carousel" }: Props) {
  const visibleSlots = useVisibleSlots();
  const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#0f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="700" fill="#ffffff" letter-spacing="2">GENTRIX</text></svg>`;
  const placeholderUrl = `data:image/svg+xml;utf8,${encodeURIComponent(placeholderSvg)}`;
  const cards = useMemo(() => {
    const base = items.slice(0, 9);
    if (base.length >= 9) return base;
    const placeholders: SocialGalleryItem[] = Array.from({ length: 9 - base.length }, (_, index) => ({
      id: `placeholder-${index}`,
      url: placeholderUrl,
      caption: "Placeholder",
    }));
    return [...base, ...placeholders];
  }, [items, placeholderUrl]);
  const maxStartIndex = useMemo(() => Math.max(0, cards.length - visibleSlots), [cards.length, visibleSlots]);
  const [startIndex, setStartIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  // Backward compatible: treat unknown layout values as carousel.
  const isCarousel = layout !== "grid";
  const canGoPrev = startIndex > 0;
  const canGoNext = startIndex < maxStartIndex;

  useEffect(() => {
    if (startIndex > maxStartIndex) setStartIndex(0);
  }, [startIndex, maxStartIndex]);

  useEffect(() => {
    if (!isCarousel || !autoPlay || maxStartIndex <= 0) return;
    const timer = window.setInterval(() => {
      setStartIndex((p) => (p >= maxStartIndex ? 0 : p + 1));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [autoPlay, maxStartIndex, isCarousel]);

  return (
    <section className="w-full py-12">
      <div className="relative mx-auto max-w-6xl px-4">
        {isCarousel ? (
          <button
            type="button"
            aria-label="Vorige"
            onClick={() => {
              setAutoPlay(false);
              setStartIndex((p) => Math.max(0, p - 1));
            }}
            disabled={!canGoPrev}
            className="absolute left-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border disabled:opacity-40"
            style={{
              borderColor: "var(--site-border, var(--site-fg, #d4d4d8))",
              color: "var(--site-foreground, var(--site-fg, #111827))",
              background: "var(--site-surface, var(--site-bg, #ffffff))",
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {isCarousel ? (
          <button
            type="button"
            aria-label="Volgende"
            onClick={() => {
              setAutoPlay(false);
              setStartIndex((p) => Math.min(maxStartIndex, p + 1));
            }}
            disabled={!canGoNext}
            className="absolute right-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border disabled:opacity-40"
            style={{
              borderColor: "var(--site-border, var(--site-fg, #d4d4d8))",
              color: "var(--site-foreground, var(--site-fg, #111827))",
              background: "var(--site-surface, var(--site-bg, #ffffff))",
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
        <div className={isCarousel ? "grid grid-cols-1 gap-4 sm:grid-cols-3" : "grid grid-cols-1 gap-4 sm:grid-cols-3"}>
          {(isCarousel ? cards.slice(startIndex, startIndex + visibleSlots) : cards).map((item) => (
            <a
              key={item.id}
              href={item.permalink ?? item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-square overflow-hidden rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.caption ?? ""}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
