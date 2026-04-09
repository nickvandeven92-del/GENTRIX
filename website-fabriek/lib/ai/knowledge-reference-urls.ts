import { z } from "zod";
import { MAX_REFERENCE_IMAGES_PER_ROW } from "@/lib/data/ai-knowledge-shared";

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Validatie voor `reference_image_urls` op POST/PATCH ai-knowledge. */
export const zKnowledgeReferenceImageUrls = z
  .array(z.string().max(2000))
  .max(MAX_REFERENCE_IMAGES_PER_ROW)
  .refine((arr) => arr.every(isHttpsUrl), {
    message: "Elke URL moet een geldige https-URL zijn (zonder userinfo).",
  });
