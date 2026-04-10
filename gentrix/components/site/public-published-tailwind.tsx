import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";
import {
  filterSectionsForPortalOnly,
  filterSectionsForPublicSite,
} from "@/lib/site/studio-section-visibility";
import { PublishedTailwindAssets } from "@/components/site/published-tailwind-assets";
import { PublishedTailwindNavBridge } from "@/components/site/published-tailwind-nav-bridge";
import { cn } from "@/lib/utils";

function escapeHtmlForSrcDocTitle(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type PublicPublishedTailwindProps = {
  sections: TailwindSection[];
  pageConfig?: TailwindPageConfig | null;
  className?: string;
  /** `public` = marketing (geen portaal-secties); `portal` = alleen portaal-secties. */
  visibility?: "public" | "portal";
  /** Voor studio-placeholders → echte paden (zelfde als iframe-preview). */
  publishedSlug?: string;
  userCss?: string;
  userJs?: string;
  logoSet?: GeneratedLogoSet | null;
  /** `<iframe title="…">` voor toegankelijkheid. */
  documentTitle?: string;
  /** `true` = onder portaal-chrome (geen vaste volledige viewport-hoogte). */
  embedded?: boolean;
  /** Publieke site: `false` = geen `/boek/`-resolutie uit placeholder. */
  appointmentsEnabled?: boolean;
  /** Publieke site: `false` = geen `/winkel/`-resolutie uit placeholder. */
  webshopEnabled?: boolean;
};

/**
 * Zelfde document als studio Live preview (`buildTailwindIframeSrcDoc` + sandbox-iframe),
 * zodat breakpoints, Tailwind-JIT en layout gelijk lopen aan de editor.
 */
export function PublicPublishedTailwind({
  sections,
  pageConfig,
  className,
  visibility = "public",
  publishedSlug,
  userCss,
  userJs,
  logoSet,
  documentTitle = "Website",
  embedded = false,
  appointmentsEnabled = true,
  webshopEnabled = true,
}: PublicPublishedTailwindProps) {
  const filtered =
    visibility === "portal"
      ? filterSectionsForPortalOnly(sections)
      : filterSectionsForPublicSite(sections);

  let srcDoc: string;
  try {
    srcDoc = buildTailwindIframeSrcDoc(filtered, pageConfig, {
      previewPostMessageBridge: false,
      userCss,
      userJs,
      logoSet,
      publishedSlug: publishedSlug?.trim(),
      appointmentsEnabled,
      webshopEnabled,
      disableScrollRevealAnimations: true,
    });
  } catch {
    srcDoc = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"/><title>${escapeHtmlForSrcDocTitle(
      documentTitle,
    )}</title></head><body style="font-family:system-ui;padding:1.5rem">Deze site kan tijdelijk niet worden opgebouwd. Vernieuw de pagina of neem contact op met de beheerder.</body></html>`;
  }

  /** RSC/response-limiet op serverless: extreem grote srcDoc breekt deployment/streaming. */
  const MAX_SRC_DOC_CHARS = 3_500_000;
  if (srcDoc.length > MAX_SRC_DOC_CHARS) {
    srcDoc = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"/><title>${escapeHtmlForSrcDocTitle(
      documentTitle,
    )}</title></head><body style="font-family:system-ui;padding:1.5rem">Deze pagina is te groot om hier te tonen. Verklein de site in de editor of splits content.</body></html>`;
  }

  const iframeStyle: React.CSSProperties = embedded
    ? {
        width: "100%",
        minHeight: "min(72vh, 720px)",
        height: "min(72vh, 720px)",
        border: "none",
        background: "white",
        overflow: "auto",
      }
    : { width: "100%", height: "100%", border: "none", background: "white", display: "block", overflow: "auto" };

  return (
    <PublishedTailwindNavBridge>
      <div
        className={cn("flex min-h-0 w-full flex-1 flex-col bg-white", className)}
        style={{ width: "100%", height: embedded ? undefined : "100%" }}
      >
        <PublishedTailwindAssets />
        <iframe
          title={documentTitle}
          style={iframeStyle}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          srcDoc={srcDoc}
        />
      </div>
    </PublishedTailwindNavBridge>
  );
}
