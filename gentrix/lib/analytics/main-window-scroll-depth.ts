import type { GentrixScrollDepth } from "@/lib/analytics/schema";

/**
 * 25/50/75/100% scrollmarks, throttled met rAF — gebruikt door first-party site-analytics.
 */
export function attachGentrixMainWindowScrollDepth(
  onDepth: (depth: GentrixScrollDepth) => void,
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  const done = new Set<GentrixScrollDepth>();
  const check = () => {
    const el = document.documentElement;
    const b = document.body;
    const sh = Math.max(b?.scrollHeight ?? 0, el.scrollHeight, 1);
    const st = window.scrollY ?? el.scrollTop;
    const vh = window.innerHeight;
    const atBottom = st + vh >= sh - 8;
    const pct = Math.min(100, Math.floor(((st + vh) / sh) * 100));
    const marks: GentrixScrollDepth[] = [25, 50, 75, 100];
    for (const m of marks) {
      if (done.has(m)) continue;
      if (pct >= m || (m === 100 && atBottom)) {
        done.add(m);
        onDepth(m);
      }
    }
  };
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      check();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  queueMicrotask(() => {
    check();
  });
  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}
