/** Publiek merk (showroom, login, metadata, flyers, concept-actiebalk). Overschrijf: `NEXT_PUBLIC_PUBLIC_BRAND`. */
export const PUBLIC_BRAND = process.env.NEXT_PUBLIC_PUBLIC_BRAND?.trim() || "Gentrix";

/** Mailto op de showroom-fallback; override met NEXT_PUBLIC_STUDIO_CONTACT_EMAIL in .env.local */
export const PUBLIC_STUDIO_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_STUDIO_CONTACT_EMAIL?.trim() || "hello@example.com";

/** Interne admin-workspace (sidebar). */
export const ADMIN_STUDIO_NAME = "Studio";
