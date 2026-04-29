import { useState, type CSSProperties } from "react";

/* ============================================================================
 * GENTRIX • ReviewStrip
 * Standalone embeddable review component + dashboard connection UI.
 * Single self-contained file. No external UI deps beyond React.
 * ========================================================================== */

export type ReviewPlatform = "google" | "trustpilot";

export interface Review {
  id: string;
  authorName: string;
  authorPhoto?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  date: string;
  platform: ReviewPlatform;
}

export interface ReviewStripProps {
  reviews: Review[];
  maxReviews?: 3 | 4 | 6;
  accentColor?: string;
  borderColor?: string;
  borderRadius?: string;
  layout?: "strip" | "grid";
  loading?: boolean;
}

/* ---------- Platform badges (inline SVG, no external assets) -------------- */

function GoogleBadge({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Google">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2A12 12 0 0 1 12.7 28l-6.6 5.1A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.2C37.2 41 44 36 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function TrustpilotBadge({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Trustpilot">
      <polygon
        fill="#00B67A"
        points="12,2 14.9,8.6 22,9.3 16.6,14 18.3,21 12,17.3 5.7,21 7.4,14 2,9.3 9.1,8.6"
      />
    </svg>
  );
}

function PlatformBadge({ platform }: { platform: ReviewPlatform }) {
  const label = platform === "google" ? "Google" : "Trustpilot";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        lineHeight: 1,
        color: "#6b7280",
      }}
    >
      {platform === "google" ? <GoogleBadge /> : <TrustpilotBadge />}
      <span>{label}</span>
    </span>
  );
}

/* ---------- Stars ---------------------------------------------------------- */

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill={i < rating ? color : "#e5e7eb"}
          aria-hidden
        >
          <polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.3,21 12,17.3 5.7,21 7.4,14 2,9.3 9.1,8.6" />
        </svg>
      ))}
    </span>
  );
}

/* ---------- Card ----------------------------------------------------------- */

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "#f1f5f9",
        color: "#475569",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}

const clampStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function ReviewCard({
  review,
  accentColor,
  borderColor,
  borderRadius,
}: {
  review: Review;
  accentColor: string;
  borderColor: string;
  borderRadius: string;
}) {
  const cardStyle: CSSProperties = {
    border: `1px solid ${borderColor}`,
    borderRadius,
    padding: 16,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
    boxSizing: "border-box",
  };

  return (
    <article style={cardStyle}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {review.authorPhoto ? (
          <img
            src={review.authorPhoto}
            alt=""
            width={36}
            height={36}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <Initials name={review.authorName} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {review.authorName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <Stars rating={review.rating} color={accentColor} />
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{review.date}</span>
          </div>
        </div>
      </header>

      <p
        style={{
          ...clampStyle,
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: "#374151",
        }}
      >
        {review.text}
      </p>

      <footer>
        <PlatformBadge platform={review.platform} />
      </footer>
    </article>
  );
}

/* ---------- Skeleton ------------------------------------------------------- */

function SkeletonCard({
  borderColor,
  borderRadius,
}: {
  borderColor: string;
  borderRadius: string;
}) {
  const bar = (w: string | number, h = 10) => (
    <div
      style={{
        width: w,
        height: h,
        background: "#eef2f7",
        borderRadius: 4,
      }}
    />
  );
  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius,
        padding: 16,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#eef2f7",
            flexShrink: 0,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {bar("60%", 12)}
          {bar("40%", 10)}
        </div>
      </div>
      {bar("100%")}
      {bar("95%")}
      {bar("70%")}
      {bar("50%", 10)}
    </div>
  );
}

/* ---------- Main component ------------------------------------------------- */

export function ReviewStrip({
  reviews,
  maxReviews = 4,
  accentColor = "#FACC15",
  borderColor = "#e5e7eb",
  borderRadius = "12px",
  layout = "strip",
  loading = false,
}: ReviewStripProps) {
  const items = reviews.slice(0, maxReviews);
  const count = loading ? maxReviews : items.length;

  const containerStyle: CSSProperties =
    layout === "grid"
      ? {
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
          gap: 16,
          width: "100%",
          boxSizing: "border-box",
        }
      : {
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: `minmax(240px, 1fr)`,
          gap: 16,
          width: "100%",
          overflowX: "auto",
          boxSizing: "border-box",
        };

  return (
    <div style={containerStyle} data-gentrix="review-strip">
      {loading
        ? Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} borderColor={borderColor} borderRadius={borderRadius} />
          ))
        : items.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              accentColor={accentColor}
              borderColor={borderColor}
              borderRadius={borderRadius}
            />
          ))}
    </div>
  );
}

/* ============================================================================
 * GENTRIX Dashboard • Reviews Connection Settings
 * Only rendered inside the dashboard. Never shipped to the client website.
 * ========================================================================== */

export interface ReviewsConnection {
  platform: ReviewPlatform;
  identifier: string; // place id or trustpilot domain
  businessName: string;
}

export interface ReviewsConnectionPanelProps {
  initialConnection?: ReviewsConnection | null;
  onConnect?: (connection: ReviewsConnection) => void;
  onDisconnect?: () => void;
  /**
   * Optional verifier. Should resolve with the business name on success,
   * or throw on failure. If omitted, a mock verifier is used.
   */
  verify?: (platform: ReviewPlatform, identifier: string) => Promise<string>;
}

const panelInput: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
  color: "#111827",
};

const panelLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  display: "block",
  marginBottom: 6,
};

const panelButton = (variant: "primary" | "ghost" | "danger"): CSSProperties => ({
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  border: "1px solid",
  cursor: "pointer",
  borderColor:
    variant === "primary" ? "#111827" : variant === "danger" ? "#fecaca" : "#d1d5db",
  background:
    variant === "primary" ? "#111827" : variant === "danger" ? "#fff" : "#fff",
  color:
    variant === "primary" ? "#fff" : variant === "danger" ? "#b91c1c" : "#111827",
});

async function mockVerify(platform: ReviewPlatform, identifier: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 800));
  if (!identifier.trim()) throw new Error("Please enter a value.");
  if (platform === "google") {
    if (!/^ChI|^[A-Za-z0-9_-]{10,}$/.test(identifier.trim()))
      throw new Error("That doesn't look like a valid Place ID.");
    return "Acme Coffee Roasters";
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(identifier.trim()))
    throw new Error("Enter a domain like example.com.");
  return identifier.trim();
}

export function ReviewsConnectionPanel({
  initialConnection = null,
  onConnect,
  onDisconnect,
  verify = mockVerify,
}: ReviewsConnectionPanelProps) {
  const [connection, setConnection] = useState<ReviewsConnection | null>(initialConnection);
  const [platform, setPlatform] = useState<ReviewPlatform>("google");
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setStatus("verifying");
    setError(null);
    try {
      const businessName = await verify(platform, identifier);
      const next: ReviewsConnection = { platform, identifier: identifier.trim(), businessName };
      setConnection(next);
      setStatus("idle");
      onConnect?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
      setStatus("error");
    }
  }

  function handleDisconnect() {
    setConnection(null);
    setIdentifier("");
    setStatus("idle");
    setError(null);
    onDisconnect?.();
  }

  const wrapper: CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    background: "#fff",
    maxWidth: 520,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  if (connection) {
    return (
      <div style={wrapper} data-gentrix="reviews-connection-panel">
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            Reviews connected
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            Showing reviews on your published site.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#f9fafb",
          }}
        >
          {connection.platform === "google" ? <GoogleBadge size={20} /> : <TrustpilotBadge size={20} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
              {connection.businessName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {connection.platform === "google" ? "Place ID: " : "Domain: "}
              {connection.identifier}
            </div>
          </div>
          <button style={panelButton("danger")} onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapper} data-gentrix="reviews-connection-panel">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
          Connect a review source
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          Choose where your customer reviews come from.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {(["google", "trustpilot"] as ReviewPlatform[]).map((p) => {
          const active = platform === p;
          return (
            <button
              key={p}
              onClick={() => {
                setPlatform(p);
                setIdentifier("");
                setError(null);
                setStatus("idle");
              }}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: `1px solid ${active ? "#111827" : "#e5e7eb"}`,
                background: active ? "#111827" : "#fff",
                color: active ? "#fff" : "#111827",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {p === "google" ? <GoogleBadge size={16} /> : <TrustpilotBadge size={16} />}
              {p === "google" ? "Google Reviews" : "Trustpilot"}
            </button>
          );
        })}
      </div>

      {platform === "google" ? (
        <div>
          <label style={panelLabel} htmlFor="gentrix-place-id">
            Google Place ID
          </label>
          <input
            id="gentrix-place-id"
            style={panelInput}
            placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            Don't know yours?{" "}
            <a
              href="https://developers.google.com/maps/documentation/places/web-service/place-id"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#2563eb", textDecoration: "underline" }}
            >
              How to find your Place ID
            </a>
          </div>
        </div>
      ) : (
        <div>
          <label style={panelLabel} htmlFor="gentrix-tp-domain">
            Trustpilot business domain
          </label>
          <input
            id="gentrix-tp-domain"
            style={panelInput}
            placeholder="example.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            The domain registered on your Trustpilot business profile.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 12,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          style={{ ...panelButton("primary"), opacity: status === "verifying" ? 0.7 : 1 }}
          onClick={handleVerify}
          disabled={status === "verifying"}
        >
          {status === "verifying" ? "Verifying…" : "Verify"}
        </button>
      </div>
    </div>
  );
}

export default ReviewStrip;
