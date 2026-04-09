import type { MetadataRoute } from "next";

const name = process.env.NEXT_PUBLIC_PWA_NAME ?? "Klantportaal";
const shortName = process.env.NEXT_PUBLIC_PWA_SHORT_NAME ?? "Portaal";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name,
    short_name: shortName,
    description: "Facturen, afspraken en account in je klantportaal.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fafafa",
    theme_color: "#18181b",
    lang: "nl",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
