import type { ReactNode } from "react";

/** Iframe-embed vanaf marketingpagina’s op hetzelfde domein of extern. */
export async function headers() {
  return {
    "Content-Security-Policy": "frame-ancestors *",
  };
}

export default function PublicWebshopLayout({ children }: { children: ReactNode }) {
  return children;
}
