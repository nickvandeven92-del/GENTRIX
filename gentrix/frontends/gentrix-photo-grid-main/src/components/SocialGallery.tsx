"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Internal responsive hook — returns the number of photos that should be
 * visible side-by-side based on the current viewport width.
 *
 *   < 640px  → 1  (mobile: one photo at a time)
 *   ≥ 640px  → 3  (tablet/iPad and desktop: three side-by-side)
 *
 * Kept inline so SocialGallery.tsx stays a single self-contained file.
 */
function useVisibleSlots(): 1 | 3 {
  const [slots, setSlots] = useState<1 | 3>(() => {
    if (typeof window === "undefined") return 3;
    return window.innerWidth < 640 ? 1 : 3;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setSlots(mql.matches ? 1 : 3);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return slots;
}

/**
 * GENTRIX — SocialGallery
 *
 * Single self-contained file exporting:
 *   - <SocialGallery />            → embeddable photo grid for client websites
 *   - <SocialGallerySettings />    → dashboard-only connection UI (Instagram / Facebook OAuth)
 *
 * The grid component is purely presentational. It does not fetch, authenticate,
 * or wrap itself in any layout. The parent (GENTRIX page renderer) controls
 * all surrounding spacing, width, and background.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface SocialPhoto {
  id: string;
  url: string;
  caption?: string;
}

export type SocialGalleryLayout = "grid" | "carousel";

export interface SocialGalleryProps {
  photos?: SocialPhoto[];
  columns?: 2 | 3;
  accentColor?: string;
  borderColor?: string;
  borderRadius?: string;
  /** When true, render skeleton placeholders instead of photos. */
  loading?: boolean;
  /** "grid" shows all photos (up to MAX_PHOTOS), "carousel" shows 3 side-by-side and scrolls. */
  layout?: SocialGalleryLayout;
}

const MAX_PHOTOS = 9;
const FALLBACK_PHOTOS: SocialPhoto[] = Array.from({ length: MAX_PHOTOS }).map((_, i) => {
  const bg = i % 3 === 0 ? "#111827" : i % 3 === 1 ? "#374151" : "#6b7280";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="56" font-weight="700" letter-spacing="6">GENTRIX</text></svg>`;
  return {
    id: `gentrix-placeholder-${i + 1}`,
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    caption: "GENTRIX placeholder",
  };
});

// ──────────────────────────────────────────────────────────────────────────────
// Photo grid (embeddable)
// ──────────────────────────────────────────────────────────────────────────────

export function SocialGallery({
  photos = [],
  columns = 3,
  accentColor = "#000000",
  borderColor = "#e5e5e5",
  borderRadius = "8px",
  loading = false,
  layout = "grid",
}: SocialGalleryProps) {
  const safeColumns: 2 | 3 = columns === 2 ? 2 : 3;
  const isCarousel = layout === "carousel";
  const slots = useVisibleSlots(); // 1 on mobile, 3 on tablet/desktop
  // Carousel: follows responsive slots (1 mobile / 3 otherwise).
  // Grid: 1 column on mobile, otherwise the chosen columns prop.
  const visibleColumns: number = isCarousel
    ? slots
    : slots === 1
      ? 1
      : safeColumns;
  const visible = (photos.length > 0 ? photos : FALLBACK_PHOTOS).slice(0, MAX_PHOTOS);

  // Carousel scroll state — drives arrow visibility/disabled state.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // Auto-advance is permanently disabled once the user interacts with the arrows.
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!isCarousel) return;
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isCarousel, visible.length, slots]);

  const scrollByOne = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    // Scroll by one slide width (incl. the 12px gap).
    const slideWidth = el.clientWidth / slots + 12;
    el.scrollBy({ left: direction * slideWidth, behavior: "smooth" });
  };

  // Auto-advance every 10s. Loops back to the start when reaching the end.
  // Stops permanently when the user clicks an arrow.
  useEffect(() => {
    if (!isCarousel || !autoPlay) return;
    if (visible.length <= slots) return; // nothing to scroll
    const id = window.setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        const slideWidth = el.clientWidth / slots + 12;
        el.scrollBy({ left: slideWidth, behavior: "smooth" });
      }
    }, 10000);
    return () => window.clearInterval(id);
  }, [isCarousel, autoPlay, visible.length, slots]);

  const handleArrow = (direction: -1 | 1) => {
    setAutoPlay(false);
    scrollByOne(direction);
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))`,
    gap: "12px",
    width: "100%",
  };

  const carouselTrackStyle: React.CSSProperties = {
    display: "grid",
    gridAutoFlow: "column",
    // Each slide takes 1/N of the visible viewport, accounting for gaps between slides.
    gridAutoColumns:
      slots === 1
        ? "100%"
        : `calc((100% - ${(slots - 1) * 12}px) / ${slots})`,
    gap: "12px",
    width: "100%",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    WebkitOverflowScrolling: "touch",
  } as React.CSSProperties;

  const cardStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    border: `1px solid ${borderColor}`,
    borderRadius,
    background: "#f5f5f5",
    boxSizing: "border-box",
    scrollSnapAlign: isCarousel ? "start" : undefined,
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  // Arrow button styling — circular, semi-transparent, overlaid on the track edges.
  const arrowBtnStyle = (side: "left" | "right", visible: boolean): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    [side]: "8px",
    transform: "translateY(-50%)",
    width: "40px",
    height: "40px",
    borderRadius: "9999px",
    border: `1px solid ${borderColor}`,
    background: "rgba(255,255,255,0.92)",
    color: accentColor,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: visible ? "pointer" : "default",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 150ms ease",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    zIndex: 2,
    padding: 0,
  });

  const containerStyle = isCarousel ? carouselTrackStyle : gridStyle;

  if (loading) {
    const placeholders = Array.from({
      length: isCarousel ? 6 : visibleColumns === 2 ? 4 : 6,
    });
    return (
      <div style={containerStyle} role="status" aria-label="Loading photos">
        {placeholders.map((_, i) => (
          <div
            key={i}
            style={{
              ...cardStyle,
              background: `linear-gradient(90deg, ${borderColor}33 0%, ${borderColor}66 50%, ${borderColor}33 100%)`,
              backgroundSize: "200% 100%",
              animation: "gentrix-skeleton 1.4s ease-in-out infinite",
            }}
          />
        ))}
        <style>{`
          @keyframes gentrix-skeleton {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  // Grid layout — no arrows needed.
  if (!isCarousel) {
    return (
      <div style={containerStyle}>
        {visible.map((photo) => (
          <div key={photo.id} style={cardStyle}>
            <img
              src={photo.url}
              alt={photo.caption ?? ""}
              style={imgStyle}
              loading="lazy"
              draggable={false}
            />
            <span style={{ display: "none" }} data-accent={accentColor} />
          </div>
        ))}
      </div>
    );
  }

  // Carousel layout — wrapped in a relative container so arrows can overlay.
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <style>{`.gentrix-carousel-track::-webkit-scrollbar{display:none;width:0;height:0;}`}</style>
      <div ref={trackRef} className="gentrix-carousel-track" style={containerStyle}>
        {visible.map((photo) => (
          <div key={photo.id} style={cardStyle}>
            <img
              src={photo.url}
              alt={photo.caption ?? ""}
              style={imgStyle}
              loading="lazy"
              draggable={false}
            />
            <span style={{ display: "none" }} data-accent={accentColor} />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous photos"
        onClick={() => handleArrow(-1)}
        style={arrowBtnStyle("left", canScrollLeft)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <button
        type="button"
        aria-label="Next photos"
        onClick={() => handleArrow(1)}
        style={arrowBtnStyle("right", canScrollRight)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard settings — connection UI (NOT rendered on client websites)
// ──────────────────────────────────────────────────────────────────────────────

export type SocialProvider = "instagram" | "facebook";

export interface SocialConnection {
  provider: SocialProvider;
  handle: string;
}

export interface SocialGallerySettingsProps {
  connection?: SocialConnection | null;
  onConnect: (provider: SocialProvider) => void | Promise<void>;
  onDisconnect: () => void | Promise<void>;
  /** Current display layout for the embedded gallery. */
  layout?: SocialGalleryLayout;
  /** Fired when the client toggles between carousel and "show all" grid. */
  onLayoutChange?: (layout: SocialGalleryLayout) => void;
  /**
   * Manually managed photos (used when no social connection is active, or
   * when the client prefers to curate the gallery themselves). Max 9.
   */
  photos?: SocialPhoto[];
  /**
   * Fired whenever the manual photo list changes (add, remove, reorder).
   * Parent is responsible for persistence and (optionally) uploading the
   * underlying File objects to permanent storage. The current implementation
   * passes data: URLs as a stand-in so the UI works without storage wired up.
   */
  onPhotosChange?: (photos: SocialPhoto[]) => void;
  accentColor?: string;
  borderColor?: string;
  borderRadius?: string;
}

const MANUAL_PHOTO_LIMIT = 9;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SocialGallerySettings({
  connection,
  onConnect,
  onDisconnect,
  layout = "grid",
  onLayoutChange,
  photos,
  onPhotosChange,
  accentColor = "#111111",
  borderColor = "#e5e5e5",
  borderRadius = "8px",
}: SocialGallerySettingsProps) {
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const manualPhotos = photos ?? [];
  const canAddMore = manualPhotos.length < MANUAL_PHOTO_LIMIT;

  const containerStyle: React.CSSProperties = {
    border: `1px solid ${borderColor}`,
    borderRadius,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 500,
    color: accentColor,
  };

  const toggleWrap: React.CSSProperties = {
    display: "inline-flex",
    border: `1px solid ${borderColor}`,
    borderRadius,
    overflow: "hidden",
    width: "fit-content",
  };

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    fontSize: "13px",
    cursor: "pointer",
    border: "none",
    background: active ? accentColor : "transparent",
    color: active ? "#ffffff" : accentColor,
    transition: "background 120ms ease",
  });

  const primaryBtn: React.CSSProperties = {
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: busy ? "wait" : "pointer",
    border: "none",
    borderRadius,
    background: accentColor,
    color: "#ffffff",
    opacity: busy ? 0.7 : 1,
    width: "fit-content",
  };

  const secondaryBtn: React.CSSProperties = {
    padding: "8px 14px",
    fontSize: "13px",
    cursor: busy ? "wait" : "pointer",
    border: `1px solid ${borderColor}`,
    borderRadius,
    background: "transparent",
    color: accentColor,
    width: "fit-content",
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      await onConnect("instagram");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await onDisconnect();
    } finally {
      setBusy(false);
    }
  };

  const layoutToggle = onLayoutChange ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={labelStyle}>Display</span>
      <div role="radiogroup" aria-label="Gallery layout" style={toggleWrap}>
        <button
          type="button"
          role="radio"
          aria-checked={layout === "carousel"}
          onClick={() => onLayoutChange("carousel")}
          style={toggleBtn(layout === "carousel")}
        >
          Carousel (3 in a row)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={layout === "grid"}
          onClick={() => onLayoutChange("grid")}
          style={toggleBtn(layout === "grid")}
        >
          Show all
        </button>
      </div>
    </div>
  ) : null;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !onPhotosChange) return;
    const remaining = MANUAL_PHOTO_LIMIT - manualPhotos.length;
    const incoming = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, remaining));
    if (incoming.length === 0) return;

    const next: SocialPhoto[] = [...manualPhotos];
    for (const file of incoming) {
      try {
        const url = await readFileAsDataUrl(file);
        next.push({
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url,
          caption: file.name,
        });
      } catch {
        // Skip files we can't read.
      }
    }
    onPhotosChange(next);
  };

  const removePhoto = (id: string) => {
    if (!onPhotosChange) return;
    onPhotosChange(manualPhotos.filter((p) => p.id !== id));
  };

  const reorder = (from: number, to: number) => {
    if (!onPhotosChange || from === to) return;
    const next = [...manualPhotos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onPhotosChange(next);
  };

  const tileStyle = (isOver: boolean, isDragging: boolean): React.CSSProperties => ({
    position: "relative",
    aspectRatio: "1 / 1",
    border: `2px ${isOver ? "solid" : "dashed"} ${isOver ? accentColor : borderColor}`,
    borderRadius,
    background: "#fafafa",
    overflow: "hidden",
    boxSizing: "border-box",
    cursor: "grab",
    opacity: isDragging ? 0.4 : 1,
    transition: "border-color 120ms ease, opacity 120ms ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const addTileStyle: React.CSSProperties = {
    aspectRatio: "1 / 1",
    border: `2px dashed ${borderColor}`,
    borderRadius,
    background: "#fafafa",
    color: "#888",
    cursor: canAddMore ? "pointer" : "not-allowed",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    gap: "4px",
    boxSizing: "border-box",
  };

  const removeBtnStyle: React.CSSProperties = {
    position: "absolute",
    top: "4px",
    right: "4px",
    width: "22px",
    height: "22px",
    borderRadius: "9999px",
    border: "none",
    background: "rgba(0,0,0,0.65)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    lineHeight: 1,
    padding: 0,
  };

  const manualManager = onPhotosChange ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={labelStyle}>Your photos</span>
        <span style={{ fontSize: "12px", color: "#888" }}>
          {manualPhotos.length} / {MANUAL_PHOTO_LIMIT}
        </span>
      </div>
      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
        Drag to reorder. Drop images below or click a slot to upload.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "8px",
        }}
      >
        {manualPhotos.map((photo, index) => (
          <div
            key={photo.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnter={() => setOverIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) reorder(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            style={tileStyle(overIndex === index && dragIndex !== index, dragIndex === index)}
          >
            <img
              src={photo.url}
              alt={photo.caption ?? ""}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              draggable={false}
            />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => removePhoto(photo.id)}
              style={removeBtnStyle}
            >
              ×
            </button>
          </div>
        ))}
        {canAddMore ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              void handleFilesSelected(e.dataTransfer.files);
            }}
            style={addTileStyle}
            disabled={!canAddMore}
          >
            <span style={{ fontSize: "22px", lineHeight: 1 }}>+</span>
            <span>Add photo</span>
          </button>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  ) : null;

  if (connection) {
    return (
      <div style={containerStyle}>
        <span style={labelStyle}>Connected account</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "14px", color: accentColor, fontWeight: 500 }}>
              @{connection.handle}
            </span>
            <span style={{ fontSize: "12px", color: "#888", textTransform: "capitalize" }}>
              {connection.provider}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy}
            style={secondaryBtn}
          >
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
        {layoutToggle}
        {manualManager}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Connect a social account</span>

      <button
        type="button"
        onClick={handleConnect}
        disabled={busy}
        style={primaryBtn}
      >
        {busy ? "Connecting…" : "Connect via Meta"}
      </button>

      {layoutToggle}
      {manualManager}
    </div>
  );
}

export default SocialGallery;
