import { z } from "zod";

export type ReviewSourcePlatform = "google" | "trustpilot";

export const reviewSourceSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  platform: z.enum(["google", "trustpilot"]).default("google"),
  identifier: z.string().trim().max(255).default(""),
  businessName: z.string().trim().max(200).default(""),
  lastSyncAt: z.string().datetime().nullable().default(null),
  lastSyncStatus: z.string().trim().max(200).nullable().default(null),
});

export const reviewItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  authorName: z.string().trim().min(1).max(120),
  rating: z.number().min(1).max(5),
  text: z.string().trim().min(1).max(1500),
  date: z.string().trim().max(80),
  platform: z.enum(["google", "trustpilot"]),
});

export type ReviewSourceSettings = z.infer<typeof reviewSourceSettingsSchema>;
export type ReviewSourceItem = z.infer<typeof reviewItemSchema>;

export function parseReviewSourceSettings(input: unknown): ReviewSourceSettings {
  return reviewSourceSettingsSchema.safeParse(input).success
    ? reviewSourceSettingsSchema.parse(input)
    : reviewSourceSettingsSchema.parse({});
}

export function parseReviewSourceItems(input: unknown): ReviewSourceItem[] {
  const arrSchema = z.array(reviewItemSchema).max(30);
  return arrSchema.safeParse(input).success ? arrSchema.parse(input) : [];
}

export function toPublicReviewSourceSettings(input: ReviewSourceSettings) {
  return {
    enabled: input.enabled,
    platform: input.platform,
    identifier: input.identifier,
    businessName: input.businessName,
    connected: Boolean(input.identifier.trim()),
    lastSyncAt: input.lastSyncAt,
    lastSyncStatus: input.lastSyncStatus,
  };
}

export function validateReviewSourceIdentifier(platform: ReviewSourcePlatform, identifier: string): string | null {
  const value = identifier.trim();
  if (!value) return "Vul een waarde in.";
  if (platform === "google") {
    if (!/^ChI|^[A-Za-z0-9_-]{10,}$/.test(value)) {
      return "Dit lijkt geen geldige Google Place ID.";
    }
    return null;
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    return "Vul een geldig domein in, bijvoorbeeld example.com.";
  }
  return null;
}

export function buildMockSyncedReviews(input: {
  platform: ReviewSourcePlatform;
  businessName: string;
}): ReviewSourceItem[] {
  const base = input.businessName.trim() || "Jouw bedrijf";
  const p = input.platform;
  return [
    {
      id: `${p}-1`,
      authorName: "Sanne Vermeer",
      rating: 5,
      text: `${base} levert topkwaliteit. Snelle reactie en heel klantvriendelijk geholpen.`,
      date: "3 dagen geleden",
      platform: p,
    },
    {
      id: `${p}-2`,
      authorName: "Milan de Groot",
      rating: 5,
      text: "Erg tevreden over het resultaat. Communicatie was duidelijk en professioneel.",
      date: "1 week geleden",
      platform: p,
    },
    {
      id: `${p}-3`,
      authorName: "Noor Bakker",
      rating: 4,
      text: "Goede ervaring, nette service en prima nazorg.",
      date: "2 weken geleden",
      platform: p,
    },
    {
      id: `${p}-4`,
      authorName: "Yara Jansen",
      rating: 5,
      text: "Zeer betrouwbare partij. Komen afspraken na en denken goed mee.",
      date: "3 weken geleden",
      platform: p,
    },
  ];
}

export function buildPlaceholderReviewsFromVisionText(input: {
  platform: ReviewSourcePlatform;
  text: string;
}): ReviewSourceItem[] {
  const lines = input.text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const candidates: { authorName: string; text: string; rating: number; date: string }[] = [];
  for (const line of lines) {
    if (candidates.length >= 8) break;
    // Typical extract patterns:
    // - "Naam — tekst ..."
    // - "Naam: tekst ..."
    // - quote-only lines (fallback author)
    let author = "";
    let body = "";
    const dashMatch = /^([A-ZÀ-ÿ][^:–—-]{1,40})\s*[–—-]\s*(.+)$/.exec(line);
    const colonMatch = /^([A-ZÀ-ÿ][^:]{1,40})\s*:\s*(.+)$/.exec(line);
    if (dashMatch) {
      author = dashMatch[1].trim();
      body = dashMatch[2].trim();
    } else if (colonMatch) {
      author = colonMatch[1].trim();
      body = colonMatch[2].trim();
    } else if (line.length >= 36) {
      author = "Klant";
      body = line;
    }
    if (!body || body.length < 24) continue;
    const ratingMatch = /([1-5](?:[.,][0-9])?)\s*(?:\/\s*5|sterren?|stars?)/i.exec(line);
    const rating = ratingMatch ? Math.max(1, Math.min(5, Number(ratingMatch[1].replace(",", ".")))) : 5;
    candidates.push({
      authorName: author || "Klant",
      text: body.slice(0, 300),
      rating,
      date: "recent",
    });
  }
  const out = candidates.slice(0, 4).map((c, idx) => ({
    id: `placeholder-${input.platform}-${idx + 1}`,
    authorName: c.authorName,
    rating: c.rating,
    text: c.text,
    date: c.date,
    platform: input.platform,
  }));
  return out;
}
