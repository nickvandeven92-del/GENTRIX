import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PUBLIC_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: PUBLIC_BRAND,
    template: `%s | ${PUBLIC_BRAND}`,
  },
  description:
    "Premium webdesign en digitale ervaringen: strategie, vormgeving en techniek voor merken die willen groeien.",
};

/**
 * Publieke routes blijven visueel light om first-paint zwart/wit flicker
 * door systeem dark-mode variabelen te voorkomen.
 */
export const viewport: Viewport = {
  colorScheme: "only light",
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
