import type { ReactNode } from "react";

/**
 * Toestaan dat externe klant-sites deze pagina in een iframe inladen (zelfde boek-flow op jullie domein).
 */
export async function headers() {
  return {
    "Content-Security-Policy": "frame-ancestors *",
  };
}

export default function PublicBookingLayout({ children }: { children: ReactNode }) {
  return children;
}
