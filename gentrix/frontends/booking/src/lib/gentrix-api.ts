/**
 * Basis-URL van de Gentrix Next.js-app (zonder slash).
 * - Leeg: relatieve `/api/...` (gebruik met Vite `server.proxy` naar :3000, of zelfde host).
 * - `https://www.gentrix.nl`: cross-origin; zet dan `BOOKING_VITE_PUBLIC_ORIGINS` op de Next-server.
 */
export function gentrixApiBase(): string {
  const v = import.meta.env.VITE_GENTRIX_API_BASE as string | undefined;
  return (typeof v === "string" ? v : "").replace(/\/$/, "");
}

export function publicBookingApiUrls(encSlug: string) {
  const base = gentrixApiBase();
  const prefix = `${base}/api/public/clients/${encSlug}`;
  return {
    slots: `${prefix}/booking-slots`,
    staff: `${prefix}/booking-staff`,
    services: `${prefix}/booking-services`,
    appointments: `${prefix}/appointments`,
  };
}
