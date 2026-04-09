/**
 * Absolute basis-URL van deze app (links in e-mail, Supabase redirectTo).
 * Zet in productie `NEXT_PUBLIC_SITE_URL` (bv. https://studio.jouwdomein.nl).
 */
export function getPublicAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    if (vercel.startsWith("http://") || vercel.startsWith("https://")) {
      return vercel.replace(/\/$/, "");
    }
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
