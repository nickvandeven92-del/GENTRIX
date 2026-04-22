"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Slanke voortgangsbalk bovenaan het scherm — geeft directe visuele bevestiging bij klikken.
 *
 * Principe (double-buffer navigatie zonder loading.tsx):
 * 1. Klik op interne link → balk start direct (feedback: klik is geregistreerd)
 * 2. Oude pagina blijft zichtbaar (geen skeleton/flash) tot RSC klaar is
 * 3. Pathname verandert → balk vult tot 100% en vervaagt → pagina is er
 *
 * Geen externe dependencies; werkt met Next.js App Router usePathname().
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const prevPathname = useRef(pathname);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startProgress = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (doneRef.current) clearTimeout(doneRef.current);
    setActive(true);
    setWidth(8);

    // Kruip richting 85% maar stop daar — RSC-aankomst triggert de rest
    let current = 8;
    tickRef.current = setInterval(() => {
      const remaining = 85 - current;
      const step = remaining * 0.12 + 0.5;
      current = Math.min(current + step, 84);
      setWidth(current);
      if (current >= 84) clearInterval(tickRef.current!);
    }, 180);
  };

  const finishProgress = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setWidth(100);
    doneRef.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 350);
  };

  // Detecteer klik op interne links
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      // Negeer externe links en modifier-klikken (nieuwe tab etc.)
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      startProgress();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Pathname-wijziging = navigatie voltooid
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      if (active) finishProgress();
    }
  }, [pathname, active]);

  // Cleanup bij unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (doneRef.current) clearTimeout(doneRef.current);
    };
  }, []);

  if (!active && width === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: "0 0 auto 0",
        height: "2px",
        width: `${width}%`,
        background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 60%, #ec4899 100%)",
        zIndex: 9999,
        pointerEvents: "none",
        transformOrigin: "left",
        transition:
          width >= 100
            ? "width 0.15s cubic-bezier(0.4,0,1,1), opacity 0.3s ease 0.15s"
            : "width 0.18s cubic-bezier(0.4,0,0.2,1)",
        opacity: width >= 100 && !active ? 0 : 1,
        boxShadow: "0 0 6px 0 rgba(139,92,246,0.5)",
      }}
    />
  );
}
