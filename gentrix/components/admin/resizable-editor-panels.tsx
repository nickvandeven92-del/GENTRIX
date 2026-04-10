"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "gentrix-site-editor-sidebar-px";

type ResizableEditorPanelsProps = {
  sidebar: ReactNode;
  main: ReactNode;
  /** Default sidebar width on large screens (px). */
  defaultSidebarPx?: number;
  minSidebarPx?: number;
  maxSidebarPx?: number;
  className?: string;
};

export function ResizableEditorPanels({
  sidebar,
  main,
  defaultSidebarPx = 400,
  minSidebarPx = 260,
  maxSidebarPx = 640,
  className,
}: ResizableEditorPanelsProps) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarPx);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw == null) return;
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n)) return;
      const cap = Math.min(maxSidebarPx, Math.max(minSidebarPx, n));
      setSidebarWidth(cap);
    } catch {
      /* ignore */
    }
  }, [minSidebarPx, maxSidebarPx]);

  const clamp = useCallback(
    (w: number) => {
      const max = Math.min(maxSidebarPx, typeof window !== "undefined" ? window.innerWidth * 0.62 : maxSidebarPx);
      return Math.min(max, Math.max(minSidebarPx, w));
    },
    [minSidebarPx, maxSidebarPx],
  );

  const persist = useCallback(
    (w: number) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Math.round(w)));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const onSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = sidebarWidth;

      const onMove = (ev: PointerEvent) => {
        const next = clamp(startW + (ev.clientX - startX));
        setSidebarWidth(next);
      };

      const onUp = (ev: PointerEvent) => {
        el.releasePointerCapture(ev.pointerId);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        const next = clamp(startW + (ev.clientX - startX));
        setSidebarWidth(next);
        persist(next);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [clamp, persist, sidebarWidth],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 lg:max-h-[min(calc(100dvh-9rem),1400px)] lg:flex-row lg:items-stretch",
        className,
      )}
    >
      <aside
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-col gap-2 lg:sticky lg:top-0 lg:max-h-[min(calc(100dvh-9rem),1400px)] lg:w-[var(--editor-sidebar-px)] lg:shrink-0 lg:overflow-y-auto",
        )}
        style={
          {
            "--editor-sidebar-px": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        {sidebar}
      </aside>

      {/* Splitter: alleen desktop; mobiel blijft gestapeld zonder sleepbalk */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(sidebarWidth)}
        aria-valuemin={minSidebarPx}
        aria-valuemax={maxSidebarPx}
        tabIndex={0}
        className={cn(
          "hidden shrink-0 cursor-col-resize self-stretch select-none lg:flex lg:w-2 lg:items-center lg:justify-center",
          "rounded-full bg-transparent hover:bg-zinc-200/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800",
          "dark:hover:bg-zinc-700/60",
        )}
        onPointerDown={onSplitterPointerDown}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 12;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            const next = clamp(sidebarWidth - step);
            setSidebarWidth(next);
            persist(next);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            const next = clamp(sidebarWidth + step);
            setSidebarWidth(next);
            persist(next);
          }
        }}
        title="Sleep om chat- en instelpaneel breder of smaller te maken"
      >
        <span
          className="block h-full min-h-[min(480px,calc(100dvh-12rem))] w-px rounded-full bg-zinc-300 dark:bg-zinc-600"
          aria-hidden
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:min-h-0 lg:max-h-[min(calc(100dvh-9rem),1400px)] lg:overflow-y-auto">
        {main}
      </div>
    </div>
  );
}
