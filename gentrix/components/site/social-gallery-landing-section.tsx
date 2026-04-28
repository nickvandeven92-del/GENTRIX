"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SocialGalleryItem } from "@/lib/social/social-gallery";

type Props = {
  items: SocialGalleryItem[];
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

export function SocialGalleryLandingSection({ items }: Props) {
  if (items.length === 0) return null;
  const visibleSlots = useVisibleSlots();
  const placeholderSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#0f172a' offset='0'/><stop stop-color='#1e293b' offset='1'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e2e8f0' font-size='46' font-family='Arial, Helvetica, sans-serif' letter-spacing='4'>GENTRIX</text></svg>`;
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
  const canGoPrev = startIndex > 0;
  const canGoNext = startIndex < maxStartIndex;

  useEffect(() => {
    if (startIndex > maxStartIndex) setStartIndex(0);
  }, [startIndex, maxStartIndex]);

  useEffect(() => {
    if (!autoPlay || maxStartIndex <= 0) return;
    const timer = window.setInterval(() => {
      setStartIndex((p) => (p >= maxStartIndex ? 0 : p + 1));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [autoPlay, maxStartIndex]);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
      <div className="relative px-10">
        <button
          type="button"
          aria-label="Vorige social posts"
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
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Volgende social posts"
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
          <ChevronRight className="size-4" />
        </button>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${visibleSlots}, minmax(0, 1fr))` }}
        >
          {cards.slice(startIndex, startIndex + visibleSlots).map((item) => (
          <a
            key={item.id}
            href={item.permalink ?? item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-square overflow-hidden"
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--site-border, color-mix(in srgb, var(--site-fg, #111827) 18%, transparent))",
              borderRadius: "var(--radius-xl, var(--radius-lg, 1rem))",
              background: "var(--site-surface, var(--site-bg, #ffffff))",
              boxShadow: "0 6px 20px color-mix(in srgb, var(--site-fg, #111827) 10%, transparent)",
            }}
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
