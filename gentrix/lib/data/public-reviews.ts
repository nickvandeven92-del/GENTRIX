import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import type { Review } from "@/frontends/gentrix-review-display-main/src/components/ReviewStrip";

export type PublicReviews = {
  enabled: boolean;
  items: Review[];
};

type ReviewSourceCols = {
  id: string;
  review_source_settings?: unknown;
  review_source_items?: unknown;
};

function parseReviewSourceSettings(raw: unknown): {
  enabled: boolean;
  platform: "google" | "trustpilot";
  identifier: string;
  businessName: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
} {
  if (typeof raw !== "object" || raw === null) {
    return {
      enabled: false,
      platform: "google",
      identifier: "",
      businessName: "",
      lastSyncAt: null,
      lastSyncStatus: null,
    };
  }
  const obj = raw as Record<string, unknown>;
  return {
    enabled: Boolean(obj.enabled),
    platform: (obj.platform === "trustpilot" ? "trustpilot" : "google") as "google" | "trustpilot",
    identifier: typeof obj.identifier === "string" ? obj.identifier.trim() : "",
    businessName: typeof obj.businessName === "string" ? obj.businessName.trim() : "",
    lastSyncAt: typeof obj.lastSyncAt === "string" ? obj.lastSyncAt : null,
    lastSyncStatus: typeof obj.lastSyncStatus === "string" ? obj.lastSyncStatus : null,
  };
}

function parseReviewSourceItems(raw: unknown): Review[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "unknown",
      authorName: typeof item.authorName === "string" ? item.authorName : "Reviewer",
      rating: Math.min(5, Math.max(1, Number(item.rating ?? 5))) as 1 | 2 | 3 | 4 | 5,
      text: typeof item.text === "string" ? item.text : "",
      date: typeof item.date === "string" ? item.date : "",
      platform: (item.platform === "trustpilot" ? "trustpilot" : "google") as "google" | "trustpilot",
    }))
    .filter((r) => r.text.trim().length > 0);
}

export async function loadPublicReviewsBySlug(slug: string): Promise<PublicReviews | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, review_source_settings, review_source_items")
      .eq("subfolder_slug", slug)
      .eq("status", "active")
      .maybeSingle<ReviewSourceCols>();

    if (error) {
      if (
        isPostgrestUnknownColumnError(error, "review_source_settings") ||
        isPostgrestUnknownColumnError(error, "review_source_items")
      ) {
        return null;
      }
      return null;
    }

    if (!data) return null;

    const settings = parseReviewSourceSettings(data.review_source_settings);
    const items = parseReviewSourceItems(data.review_source_items);

    if (!settings.enabled || items.length === 0) {
      return { enabled: false, items: [] };
    }

    return {
      enabled: true,
      items: items.slice(0, 6), // Max 6 reviews
    };
  } catch {
    return null;
  }
}
