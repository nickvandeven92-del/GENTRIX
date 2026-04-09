/** Publiek merk (showroom, klant-sites metadata). */
export const PUBLIC_BRAND = "Premium Web Solutions";

/** Mailto op de showroom-fallback; override met NEXT_PUBLIC_STUDIO_CONTACT_EMAIL in .env.local */
export const PUBLIC_STUDIO_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_STUDIO_CONTACT_EMAIL?.trim() || "hello@example.com";

/** Interne admin-workspace (sidebar). */
export const ADMIN_STUDIO_NAME = "Studio";
