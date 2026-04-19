import type { ReactNode } from "react";

/**
 * Externe klant-sites mogen deze “popup-shell” in een iframe inladen;
 * het echte boeken gebeurt in het geneste frame naar `/booking-app/book/…`.
 */
export async function headers() {
  return {
    "Content-Security-Policy": "frame-ancestors *",
  };
}

export default function BoekVensterLayout({ children }: { children: ReactNode }) {
  return children;
}
