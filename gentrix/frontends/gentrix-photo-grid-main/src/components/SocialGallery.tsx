import { useEffect, useState } from "react";

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
  photos: SocialPhoto[];
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

// ──────────────────────────────────────────────────────────────────────────────
// Photo grid (embeddable)
// ──────────────────────────────────────────────────────────────────────────────

export function SocialGallery({
  photos,
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
  const visible = photos.slice(0, MAX_PHOTOS);

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
    scrollbarWidth: "thin",
    WebkitOverflowScrolling: "touch",
  };

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

  if (visible.length === 0) {
    return (
      <div style={gridStyle}>
        <div
          style={{
            ...cardStyle,
            aspectRatio: "auto",
            padding: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            color: borderColor,
            fontSize: "14px",
            gridColumn: `span ${visibleColumns}`,
          }}
        >
          No photos to display
        </div>
      </div>
    );
  }

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
          {/* accentColor reserved for future visual accents (e.g. focus rings)
              without altering layout. Referenced here to keep prop meaningful. */}
          <span style={{ display: "none" }} data-accent={accentColor} />
        </div>
      ))}
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
  accentColor?: string;
  borderColor?: string;
  borderRadius?: string;
}

export function SocialGallerySettings({
  connection,
  onConnect,
  onDisconnect,
  layout = "grid",
  onLayoutChange,
  accentColor = "#111111",
  borderColor = "#e5e5e5",
  borderRadius = "8px",
}: SocialGallerySettingsProps) {
  const [provider, setProvider] = useState<SocialProvider>(
    connection?.provider ?? "instagram",
  );
  const [busy, setBusy] = useState(false);

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
      await onConnect(provider);
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
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Connect a social account</span>

      <div role="radiogroup" aria-label="Social provider" style={toggleWrap}>
        <button
          type="button"
          role="radio"
          aria-checked={provider === "instagram"}
          onClick={() => setProvider("instagram")}
          style={toggleBtn(provider === "instagram")}
        >
          Instagram
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={provider === "facebook"}
          onClick={() => setProvider("facebook")}
          style={toggleBtn(provider === "facebook")}
        >
          Facebook
        </button>
      </div>

      <button
        type="button"
        onClick={handleConnect}
        disabled={busy}
        style={primaryBtn}
      >
        {busy ? "Connecting…" : `Connect ${provider === "instagram" ? "Instagram" : "Facebook"}`}
      </button>

      {layoutToggle}
    </div>
  );
}

export default SocialGallery;