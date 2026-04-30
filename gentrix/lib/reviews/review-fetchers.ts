import type { ReviewSourceItem, ReviewSourcePlatform } from "@/lib/reviews/review-source";

type FetchResult =
  | { ok: true; items: ReviewSourceItem[]; businessName?: string; status: string }
  | { ok: false; error: string };

function toDateLabel(input: string | null | undefined): string {
  if (!input) return "recent";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "recent";
  const now = Date.now();
  const diffDays = Math.max(0, Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays <= 1) return "vandaag";
  if (diffDays < 7) return `${diffDays} dagen geleden`;
  if (diffDays < 31) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "en"} geleden`;
  return `${Math.floor(diffDays / 30)} maand${Math.floor(diffDays / 30) === 1 ? "" : "en"} geleden`;
}

function normalizeText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "text" in (v as Record<string, unknown>)) {
    const t = (v as { text?: unknown }).text;
    return typeof t === "string" ? t.trim() : "";
  }
  return "";
}

function sanitize(items: ReviewSourceItem[]): ReviewSourceItem[] {
  return items
    .filter((it) => it.authorName.trim().length > 0 && it.text.trim().length >= 20)
    .slice(0, 20);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchGooglePlaceReviews(placeId: string): Promise<FetchResult> {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_AI_STUDIO_API?.trim();
  if (!apiKey) {
    return { ok: false, error: "GOOGLE_PLACES_API_KEY ontbreekt op de server." };
  }
  const pid = placeId.trim();
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(pid)}`;
  const fields = "id,displayName,reviews";
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Google Places fout (${res.status}): ${body.slice(0, 240)}` };
  }
  const json = (await res.json()) as {
    displayName?: { text?: string };
    reviews?: Array<{
      name?: string;
      rating?: number;
      text?: { text?: string };
      relativePublishTimeDescription?: string;
      publishTime?: string;
      authorAttribution?: { displayName?: string };
    }>;
  };
  const items = sanitize(
    (json.reviews ?? []).map((r, idx) => ({
      id: r.name?.trim() || `google-${idx + 1}`,
      authorName: r.authorAttribution?.displayName?.trim() || "Google gebruiker",
      rating: Math.max(1, Math.min(5, Number(r.rating ?? 5))),
      text: normalizeText(r.text),
      date: r.relativePublishTimeDescription?.trim() || toDateLabel(r.publishTime),
      platform: "google" as ReviewSourcePlatform,
    })),
  );
  if (items.length === 0) return { ok: false, error: "Geen bruikbare Google reviews gevonden." };
  return { ok: true, items, businessName: json.displayName?.text?.trim(), status: "Google reviews opgehaald" };
}

async function trustpilotFetch(path: string, apiKey: string): Promise<Response> {
  const u = new URL(`https://api.trustpilot.com/v1${path}`);
  u.searchParams.set("apikey", apiKey);
  return fetchWithTimeout(u.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function fetchTrustpilotReviews(domain: string): Promise<FetchResult> {
  const apiKey = process.env.TRUSTPILOT_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "TRUSTPILOT_API_KEY ontbreekt op de server." };
  }
  const d = domain.trim().toLowerCase();
  const findRes = await trustpilotFetch(`/business-units/find?name=${encodeURIComponent(d)}`, apiKey);
  if (!findRes.ok) {
    const body = await findRes.text().catch(() => "");
    return { ok: false, error: `Trustpilot find fout (${findRes.status}): ${body.slice(0, 240)}` };
  }
  const findJson = (await findRes.json()) as { id?: string; displayName?: string; name?: string };
  const businessUnitId = findJson.id?.trim();
  if (!businessUnitId) return { ok: false, error: "Geen Trustpilot business unit gevonden." };

  const reviewsRes = await trustpilotFetch(
    `/business-units/${encodeURIComponent(businessUnitId)}/reviews?perPage=20&page=1`,
    apiKey,
  );
  if (!reviewsRes.ok) {
    const body = await reviewsRes.text().catch(() => "");
    return { ok: false, error: `Trustpilot reviews fout (${reviewsRes.status}): ${body.slice(0, 240)}` };
  }
  const reviewsJson = (await reviewsRes.json()) as {
    reviews?: Array<{
      id?: string;
      stars?: number;
      title?: string;
      text?: string;
      createdAt?: string;
      consumer?: { displayName?: string };
    }>;
  };
  const items = sanitize(
    (reviewsJson.reviews ?? []).map((r, idx) => {
      const text = [r.title?.trim(), r.text?.trim()].filter(Boolean).join(" — ").trim();
      return {
        id: r.id?.trim() || `trustpilot-${idx + 1}`,
        authorName: r.consumer?.displayName?.trim() || "Trustpilot gebruiker",
        rating: Math.max(1, Math.min(5, Number(r.stars ?? 5))),
        text,
        date: toDateLabel(r.createdAt),
        platform: "trustpilot" as ReviewSourcePlatform,
      };
    }),
  );
  if (items.length === 0) return { ok: false, error: "Geen bruikbare Trustpilot reviews gevonden." };
  return {
    ok: true,
    items,
    businessName: findJson.displayName?.trim() || findJson.name?.trim(),
    status: "Trustpilot reviews opgehaald",
  };
}
