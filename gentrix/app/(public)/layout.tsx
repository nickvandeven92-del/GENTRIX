import type { Metadata } from "next";
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

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
