/** Laatste studio-slug voor de geïnstalleerde Boekingen-app (PWA), los van het Gentrix-klantportaal. */
export const BOOKINGS_APP_SLUG_KEY = "gentrix-bookings-app-slug";

export function rememberBookingsAppSlug(slug: string): void {
  const s = slug.trim().toLowerCase();
  if (!s) return;
  try {
    localStorage.setItem(BOOKINGS_APP_SLUG_KEY, s);
  } catch {
    /* private mode / quota */
  }
}

export function readRememberedBookingsAppSlug(): string | null {
  try {
    const v = localStorage.getItem(BOOKINGS_APP_SLUG_KEY)?.trim().toLowerCase();
    return v || null;
  } catch {
    return null;
  }
}

export function isBookingsAppStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)");
  const ios = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mq.matches || ios;
}
