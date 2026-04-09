import type { Metadata } from "next";
import { ShowroomFallback } from "@/components/public/showroom-fallback";
import { PUBLIC_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: PUBLIC_BRAND,
};

/** Publieke homepage: vaste hypermoderne bureau-landingspagina (geen gepubliceerde `home`-site meer op `/`). */
export default function PublicHomePage() {
  return <ShowroomFallback />;
}
