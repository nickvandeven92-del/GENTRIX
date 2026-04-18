import type { CSSProperties } from "react";
import { ReactSiteSectionView } from "@/components/site/react-site/react-site-sections";
import {
  filterReactSectionsForPortalOnly,
  filterReactSectionsForPublicSite,
  filterReactSectionsForWebshop,
} from "@/lib/site/react-section-visibility";
import type { ReactSiteDocument } from "@/lib/site/react-site-schema";
import { classForFixedNavOverlap, siteHasFixedNavOverlay } from "@/lib/site/react-fixed-nav-inset";
import {
  applyStudioPublishedPathPlaceholders,
  neutralizeStudioPathPlaceholdersWithoutSlug,
  stripLeakedStudioPlaceholderTokens,
} from "@/lib/site/studio-section-visibility";
import { cn } from "@/lib/utils";

const ACCENT_CSS_VAR = "--site-accent";

type ReactPublishedSiteViewProps = {
  doc: ReactSiteDocument;
  className?: string;
  visibility?: "public" | "portal";
  publishedSlug?: string;
  /** Onder portaal-chrome: beperkte min-hoogte (vergelijkbaar met embedded Tailwind-iframe). */
  embedded?: boolean;
  /** \`false\` op publieke site: boek-placeholder wordt \`#\`. */
  appointmentsEnabled?: boolean;
  /** \`false\` op publieke site: webshop-placeholder wordt \`#\`. */
  webshopEnabled?: boolean;
};

export function ReactPublishedSiteView({
  doc,
  className,
  visibility = "public",
  publishedSlug,
  embedded = false,
  webshopEnabled = true,
}: ReactPublishedSiteViewProps) {
  const sections = (() => {
    const base =
      visibility === "portal"
        ? filterReactSectionsForPortalOnly(doc.sections)
        : filterReactSectionsForPublicSite(doc.sections);
    return visibility === "public" ? filterReactSectionsForWebshop(base, webshopEnabled) : base;
  })();

  const resolveHref = (href: string) => {
    const slug = publishedSlug?.trim();
    if (!slug) return neutralizeStudioPathPlaceholdersWithoutSlug(href);
    return stripLeakedStudioPlaceholderTokens(applyStudioPublishedPathPlaceholders(href, slug));
  };

  const sans = doc.theme.fontSans?.trim();
  const serif = doc.theme.fontSerif?.trim();
  const fallbackSans =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
  const rootStyle = {
    "--site-primary": doc.theme.primary,
    "--site-accent": doc.theme.accent,
    "--site-background": doc.theme.background,
    "--site-foreground": doc.theme.foreground,
    "--site-font-sans": sans || fallbackSans,
    /** Logo: alleen echt ander lettertype als \`theme.fontSerif\` gezet is; anders zelfde stack als UI. */
    "--site-font-serif": serif || sans || fallbackSans,
    ...(doc.theme.mutedForeground != null && doc.theme.mutedForeground !== ""
      ? { "--site-muted-foreground": doc.theme.mutedForeground }
      : {}),
    ...(sans ? { fontFamily: sans } : { fontFamily: fallbackSans }),
  } as CSSProperties;

  const hasFixedNav = siteHasFixedNavOverlay(sections);

  if (sections.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[40vh] items-center justify-center bg-zinc-50 px-6 text-center text-sm text-zinc-600",
          className,
        )}
      >
        {visibility === "portal" ? (
          <p className="max-w-md">
            Nog geen portaal-secties: zet bij betreffende secties{" "}
            <code className="rounded bg-zinc-200 px-1 font-mono text-xs">studioVisibility: &quot;portal&quot;</code> in
            de JSON.
          </p>
        ) : (
          <p className="max-w-md">Geen publieke secties om te tonen.</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "react-published-site w-full bg-[var(--site-background)] text-[var(--site-foreground)] antialiased",
        embedded ? "min-h-[min(72vh,720px)]" : "min-h-screen",
        /* fixed nav (nav_overlay) moet t.o.v. deze preview kleven, niet t.o.v. de hele viewport (admin UI). */
        embedded && "relative isolate [transform:translateZ(0)]",
        className,
      )}
      style={rootStyle}
    >
      {sections.map((section) => (
        <ReactSiteSectionView
          key={`${section.type}-${section.id}`}
          section={section}
          accentVar={ACCENT_CSS_VAR}
          resolveHref={resolveHref}
          fixedNavOverlapClass={classForFixedNavOverlap(section.type, hasFixedNav)}
          embedded={embedded}
        />
      ))}
    </div>
  );
}
