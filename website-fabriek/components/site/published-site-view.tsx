import type { PublishedSitePayload } from "@/lib/site/project-published-payload";
import { ReactPublishedSiteView } from "@/components/site/react-published-site-view";
import { filterTailwindSectionsForAppointments } from "@/lib/site/filter-tailwind-booking";
import { filterTailwindSectionsForWebshop } from "@/lib/site/filter-tailwind-webshop";
import { PublicPublishedTailwind } from "@/components/site/public-published-tailwind";
import { SiteRenderer } from "@/components/site/site-renderer";
import { cn } from "@/lib/utils";

type PublishedSiteViewProps = {
  payload: PublishedSitePayload;
  className?: string;
  publishedSlug?: string;
  visibility?: "public" | "portal";
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /**
   * Admin-routes (concept-preview): `nav_overlay` gebruikt `position:fixed` — zonder dit kleef je aan de hele viewport.
   */
  embedReactInChrome?: boolean;
};

/** Publieke weergave: `tailwind_sections` (HTML) of `react_sections` (legacy JSON-contract); legacy vrije JSON via `SiteRenderer`. */
export function PublishedSiteView({
  payload,
  className,
  publishedSlug,
  visibility = "public",
  appointmentsEnabled = true,
  webshopEnabled = true,
  embedReactInChrome = false,
}: PublishedSiteViewProps) {
  if (payload.kind === "react") {
    return (
      <div className="relative flex min-h-screen w-full flex-1 flex-col">
        <ReactPublishedSiteView
          doc={payload.doc}
          className={cn("min-h-0 flex-1", className)}
          visibility={visibility}
          publishedSlug={publishedSlug}
          embedded={visibility === "portal" || embedReactInChrome}
          appointmentsEnabled={appointmentsEnabled}
          webshopEnabled={webshopEnabled}
        />
      </div>
    );
  }

  if (payload.kind === "tailwind") {
    const docTitle = payload.clientName?.trim() || "Website";
    const isFullPage = visibility !== "portal";
    const sections =
      visibility === "public"
        ? filterTailwindSectionsForWebshop(
            filterTailwindSectionsForAppointments(payload.sections, appointmentsEnabled),
            webshopEnabled,
          )
        : payload.sections;
    return (
      <div
        className={cn(
          "relative flex w-full flex-col",
          isFullPage ? "h-dvh overflow-hidden" : "min-h-screen flex-1",
        )}
      >
        <PublicPublishedTailwind
          sections={sections}
          pageConfig={payload.config}
          className={cn("min-h-0 flex flex-1 flex-col", className)}
          visibility={visibility}
          publishedSlug={publishedSlug}
          userCss={payload.customCss}
          userJs={payload.customJs}
          logoSet={payload.logoSet}
          documentTitle={docTitle}
          embedded={visibility === "portal"}
          appointmentsEnabled={appointmentsEnabled}
          webshopEnabled={webshopEnabled}
        />
      </div>
    );
  }

  if (visibility === "portal") {
    return (
      <div className={className ?? "min-h-screen bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"}>
        <p className="mx-auto max-w-md">
          Portaal-preview ondersteunt geen legacy JSON. Gebruik <strong>tailwind_sections</strong> met{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">data-studio-visibility=&quot;portal&quot;</code>{" "}
          op portaal-secties, of migreer naar een moderne site in de studio.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
        <strong>Legacy-site</strong>. Genereer opnieuw in de site-studio (HTML + Tailwind).
      </div>
      <SiteRenderer data={payload.site} className="min-h-0 flex-1" />
    </div>
  );
}
