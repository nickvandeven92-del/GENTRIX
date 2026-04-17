import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";

/** Gelijk aan max. in `generate-site-request-schema` voor briefing-beelden. */
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_CHARS = 14_000;

export type BriefingVisionImageInput = { url: string; label?: string };

function normalizeMediaType(contentType: string | null, bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const ct = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ct === "image/png" || ct === "image/jpeg" || ct === "image/jpg" || ct === "image/webp" || ct === "image/gif") {
    if (ct === "image/jpg") return "image/jpeg";
    return ct as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  return "image/jpeg";
}

async function fetchImageAsBase64(url: string): Promise<{ mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } | null> {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u, { redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(buf);
    const mediaType = normalizeMediaType(res.headers.get("content-type"), bytes);
    return { mediaType, data: buf.toString("base64") };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type ExtractBriefingReferenceImagesVisionResult = {
  text: string;
  /** `true` alleen als `messages.create` is aangeroepen (fetch naar Anthropic). */
  visionApiCalled: boolean;
};

/**
 * Leest alle briefing-referentieafbeeldingen (screenshots, UI-voorbeelden, reviews, flyers, …)
 * via vision en levert compacte markdown voor de site-generatieprompt.
 */
export async function extractBriefingReferenceImagesWithVision(params: {
  client: Anthropic;
  model: string;
  businessName: string;
  descriptionSnippet: string;
  images: BriefingVisionImageInput[];
}): Promise<ExtractBriefingReferenceImagesVisionResult> {
  const { client, model, businessName, descriptionSnippet, images } = params;
  const withUrl = images.map((i) => ({ ...i, url: i.url?.trim() ?? "" })).filter((i) => i.url.length > 0);
  if (withUrl.length === 0) return { text: "", visionApiCalled: false };

  const imageBlocks: ContentBlockParam[] = [];
  for (const img of withUrl.slice(0, MAX_IMAGES)) {
    const loaded = await fetchImageAsBase64(img.url);
    if (!loaded) continue;
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: loaded.mediaType, data: loaded.data },
    });
  }
  if (imageBlocks.length === 0) return { text: "", visionApiCalled: false };

  const system = [
    "Je bent een extractie-assistent voor een webstudio: de klant plakt briefing-screenshots en referentiebeelden.",
    "Taak: alle **zichtbare, relevante inhoud** voor een nieuwe website vastleggen — niet alleen reviews.",
    "Neem mee waar van toepassing: koppen, slogans, menulabels, USP’s, diensten/prijzen (als leesbaar), openingstijden, adres/telefoon, bullets, knopteksten, korte lopende tekst, **en** review-/Google-citaten met naam/sterren/datum als die in beeld zijn.",
    "Laat weg: browser-UI (adresbalk, tabs), systeembalken, willekeurige kleine UI-ruis, volledige algemene voorwaarden — tenzij de klant duidelijk daarom vraagt.",
    "Geen JSON, geen markdown code fences, geen praatje vooraf/na — alleen de extractie.",
    "Structuur: gebruik korte markdown met duidelijke kopjes (bijv. ## Zichtbare tekst, ## Reviews, ## Prijzen & pakketten) alleen als het de scanbaarheid helpt.",
    'Als er praktisch geen bruikbare tekst of inhoud voor de site is: antwoord exact op één regel: GEEN_RELEVANTE_INHOUD',
  ].join("\n");

  const labelNote = withUrl
    .slice(0, MAX_IMAGES)
    .map((i, idx) => (i.label ? `Afbeelding ${idx + 1} label: ${i.label}` : null))
    .filter(Boolean)
    .join("\n");

  const userText = `Bedrijfsnaam (context): ${businessName}

Briefingfragment (tekstveld van de klant):
${descriptionSnippet.trim()}

${labelNote ? `${labelNote}\n` : ""}
Bijgevoegd: ${imageBlocks.length} afbeelding(en). Lees alles wat **inhoudelijk** helpt om de site te bouwen (tekst + eventuele duidelijke structuur-hints: "twee kolommen", "prijzentabel", …).`;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: clampMaxTokensNonStreaming(model, 8192),
      system,
      messages: [{ role: "user", content: [{ type: "text", text: userText }, ...imageBlocks] }],
    });

    await logClaudeMessageUsage("briefing_reference_images_vision", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { text: "", visionApiCalled: true };

    let t = textBlock.text.trim();
    if (/^GEEN_RELEVANTE_INHOUD\b/i.test(t)) return { text: "", visionApiCalled: true };
    if (t.length > MAX_OUTPUT_CHARS) t = t.slice(0, MAX_OUTPUT_CHARS);
    return { text: t, visionApiCalled: true };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[extractBriefingReferenceImagesWithVision]", e);
    }
    return { text: "", visionApiCalled: true };
  }
}
