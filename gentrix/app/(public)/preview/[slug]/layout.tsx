import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import {
  publishedSiteViewTransitionMetadata,
  publishedSiteViewTransitionScopedCss,
} from "@/lib/site/published-view-transition-shell";

export const metadata: Metadata = publishedSiteViewTransitionMetadata;

export const viewport: Viewport = {
  colorScheme: "only light",
  width: "device-width",
  initialScale: 1,
};

export default function PreviewSlugLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        body{background:#fff!important;color:#171717!important}
        a,button,[role="button"],summary{
          -webkit-tap-highlight-color:transparent;
          tap-highlight-color:transparent;
        }
        ${publishedSiteViewTransitionScopedCss}
      `}</style>
      {children}
    </>
  );
}
