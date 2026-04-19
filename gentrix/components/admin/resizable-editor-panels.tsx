"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const DEFAULT_STORAGE_KEY = "gentrix-site-editor-sidebar-px";
/** Ruimte voor de sleepbalk (`md:w-3` ≈ 12px). */
const SPLITTER_PX = 12;

type ResizableEditorPanelsProps = {
  sidebar: ReactNode;
  main: ReactNode;
  /**
   * `both` = sleepbare twee kolommen. `sidebar` / `main` = één paneel op volle breedte (Lovable-achtige focus).
   */
  visiblePanels?: "both" | "sidebar" | "main";
  /** localStorage-key voor sidebarbreedte (default: zelfde als HTML-editor). */
  storageKey?: string;
  /** Default sidebar width on large screens (px). */
  defaultSidebarPx?: number;
  minSidebarPx?: number;
  maxSidebarPx?: number;
  /**
   * Minimale breedte van het rechterpaneel (preview + tools) op `lg+`.
   * De sidebar wordt begrensd zodat dit paneel niet smaller wordt (geen horizontale scrollbar).
   */
  minMainPx?: number;
  /** Tooltip op de sleepbalk (default: generieke uitleg met minimale previewbreedte). */
  splitterTitle?: string;
  className?: string;
};

function boundsForHost(
  hostWidth: number,
  minSidebarPx: number,
  maxSidebarPx: number,
  minMainPx: number,
  /** Alleen op `md+` (twee kolommen); op smalle schermen geen `minMainPx` om state niet “dicht te knijpen”. */
  enforceMinMain: boolean,
) {
  if (!enforceMinMain || !Number.isFinite(hostWidth) || hostWidth <= 0) {
    return { min: minSidebarPx, max: maxSidebarPx };
  }
  const inner = hostWidth - SPLITTER_PX;
  let maxSidebar = Math.min(maxSidebarPx, Math.max(0, inner - minMainPx));
  if (maxSidebar < minSidebarPx && inner > minSidebarPx) {
    maxSidebar = Math.min(maxSidebarPx, inner - minSidebarPx);
  }
  const maxS = Math.min(maxSidebarPx, Math.max(0, maxSidebar));
  /** Geen aparte “maxS < 1 ⇒ min 0”-tak: die gaf een harde knik t.o.v. net-boven-0. */
  const minS = Math.min(minSidebarPx, maxS);
  const maxClamped = Math.max(minS, maxS);
  return { min: minS, max: maxClamped };
}

export function ResizableEditorPanels({
  sidebar,
  main,
  visiblePanels = "both",
  storageKey = DEFAULT_STORAGE_KEY,
  defaultSidebarPx = 400,
  minSidebarPx = 260,
  maxSidebarPx = 640,
  minMainPx = 768,
  splitterTitle,
  className,
}: ResizableEditorPanelsProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const storageHydrated = useRef(false);
  /** Voorkomt dat hostWidth-reclamp tijdens slepen de breedte “verliest” t.o.v. pointermove (verspringen). */
  const splitterDragActiveRef = useRef(false);
  const [hostWidth, setHostWidth] = useState(0);
  const [splitLayout, setSplitLayout] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarPx);

  useEffect(() => {
    if (typeof window === "undefined") return;
    /** Gelijk aan Tailwind `md:` (768px) — zelfde split als generator/editor op smallere laptopvensters. */
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setSplitLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHostWidth(el.getBoundingClientRect().width);
    });
    ro.observe(el);
    setHostWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback(
    (w: number, widthOverride?: number) => {
      const hw = widthOverride ?? hostWidth;
      const { min, max } = boundsForHost(hw, minSidebarPx, maxSidebarPx, minMainPx, splitLayout);
      if (max < min) return min;
      return Math.min(max, Math.max(min, w));
    },
    [hostWidth, minSidebarPx, maxSidebarPx, minMainPx, splitLayout],
  );

  useEffect(() => {
    if (hostWidth <= 0 || splitterDragActiveRef.current) return;
    queueMicrotask(() => {
      if (splitterDragActiveRef.current) return;
      setSidebarWidth((w) => (w === clamp(w) ? w : clamp(w)));
    });
  }, [hostWidth, clamp]);

  useEffect(() => {
    if (hostWidth <= 0 || storageHydrated.current) return;
    storageHydrated.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw == null) return;
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n)) return;
      queueMicrotask(() => setSidebarWidth(clamp(n, hostWidth)));
    } catch {
      /* ignore */
    }
  }, [hostWidth, clamp, storageKey]);

  const persist = useCallback(
    (w: number) => {
      try {
        window.localStorage.setItem(storageKey, String(Math.round(w)));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const { min: effMinSidebar, max: effMaxSidebar } = boundsForHost(
    hostWidth,
    minSidebarPx,
    maxSidebarPx,
    minMainPx,
    splitLayout,
  );

  const onSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      splitterDragActiveRef.current = true;
      const startX = e.clientX;
      const startW = sidebarWidth;
      const hw = hostRef.current?.getBoundingClientRect().width ?? hostWidth;

      const onMove = (ev: PointerEvent) => {
        const next = clamp(startW + (ev.clientX - startX), hw);
        setSidebarWidth(next);
      };

      const onUp = (ev: PointerEvent) => {
        el.releasePointerCapture(ev.pointerId);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        const hwUp = hostRef.current?.getBoundingClientRect().width ?? hostWidth;
        const next = clamp(startW + (ev.clientX - startX), hwUp);
        setSidebarWidth(next);
        persist(next);
        splitterDragActiveRef.current = false;
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [clamp, persist, sidebarWidth, hostWidth],
  );

  const showBoth = visiblePanels === "both";
  const showSidebar = visiblePanels === "both" || visiblePanels === "sidebar";
  const showMain = visiblePanels === "both" || visiblePanels === "main";

  return (
    <div
      ref={hostRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-0 md:flex-row md:items-stretch md:overflow-hidden",
        className,
      )}
    >
      <aside
        className={cn(
          /* Eén verticale scroll: binnen de sidebar-content (o.a. studio-chat), niet hier — voorkomt scrollbar-in-scrollbar. */
          "flex min-h-0 w-full min-w-0 flex-col gap-2 md:h-full md:max-h-full md:overflow-hidden md:pl-4 md:pt-3 md:pr-1",
          showBoth && "md:w-[var(--editor-sidebar-px)] md:shrink-0",
          !showSidebar && "hidden",
          visiblePanels === "sidebar" && "md:flex-1",
        )}
        style={
          {
            "--editor-sidebar-px": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        {sidebar}
      </aside>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(sidebarWidth)}
        aria-valuemin={Math.round(effMinSidebar)}
        aria-valuemax={Math.round(effMaxSidebar)}
        tabIndex={0}
        className={cn(
          "relative z-20 shrink-0 touch-none cursor-col-resize self-stretch select-none md:w-3 md:items-center md:justify-center",
          "rounded-full bg-zinc-200/40 hover:bg-zinc-200/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800",
          "dark:bg-zinc-700/35 dark:hover:bg-zinc-600/70",
          showBoth ? "hidden md:flex" : "hidden",
        )}
        onPointerDown={onSplitterPointerDown}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 12;
          const hw = hostRef.current?.getBoundingClientRect().width ?? hostWidth;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            const next = clamp(sidebarWidth - step, hw);
            setSidebarWidth(next);
            persist(next);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            const next = clamp(sidebarWidth + step, hw);
            setSidebarWidth(next);
            persist(next);
          }
        }}
        title={
          splitterTitle ??
          "Sleep om chat- en instelpaneel breder of smaller te maken (preview houdt minimale breedte)"
        }
      >
        <span
          className="pointer-events-none block h-full min-h-[min(480px,calc(100dvh-12rem))] w-1 max-w-[4px] rounded-full bg-zinc-400/90 dark:bg-zinc-500"
          aria-hidden
        />
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden md:h-full md:max-h-full md:min-h-0 md:overflow-y-auto md:overflow-x-hidden md:pt-3 md:pr-4",
          !showMain && "hidden",
          visiblePanels === "main" && "md:flex-1",
        )}
      >
        {main}
      </div>
    </div>
  );
}
