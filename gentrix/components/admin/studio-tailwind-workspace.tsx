"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Pencil, Sparkles } from "lucide-react";
import { GeneratorForm } from "@/components/admin/generator-form";
import { GeneratorStudioFaqLauncher } from "@/components/admin/generator-studio-faq-launcher";
import { StudioSupportStrip } from "@/components/sales-os/studio-support-strip";
import { SiteHtmlEditor } from "@/components/admin/site-html-editor";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { SnapshotPageType } from "@/lib/site/snapshot-page-type";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { cn } from "@/lib/utils";

type Tab = "edit" | "generate";

export type StudioTailwindWorkspaceProps = {
  subfolderSlug: string;
  /** DB `clients.updated_at` — wijzigt bij elke site-opslag; gebruikt als React `key` zodat de editor na `router.refresh()` opnieuw mount met verse secties. */
  draftUpdatedAt: string;
  initialName: string;
  initialDescription: string | null;
  initialStatus: "draft" | "active" | "paused" | "archived";
  initialSections: TailwindSection[];
  initialConfig: TailwindPageConfig | null | undefined;
  initialPageType?: SnapshotPageType;
  initialCustomCss?: string;
  initialCustomJs?: string;
  initialLogoSet?: GeneratedLogoSet;
  /** Multi-page: contact-subroute `/site/{slug}/contact` — meesturen bij opslaan zodat de API ze niet weglaat. */
  initialContactSections?: TailwindSection[];
  /** Multi-page: marketing-subroutes `/site/{slug}/…` — idem. */
  initialMarketingPages?: Record<string, TailwindSection[]>;
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  initialSiteIr?: SiteIrV1 | null;
  draftPublicPreviewToken?: string | null;
  /** Uit snapshot: inline in iframe-preview i.p.v. Play CDN. */
  initialTailwindCompiledCss?: string | null;
};

/**
 * Eén werkruimte (Lovable-achtig): AI-chat + preview (editor) en tab voor volledige hergeneratie uit briefing.
 */
export function StudioTailwindWorkspace(props: StudioTailwindWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("edit");

  const onSiteSaved = useCallback(() => {
    router.refresh();
    setTab("edit");
  }, [router]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-zinc-200 px-2 dark:border-zinc-800">
        <div className="inline-flex h-7 items-center rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80">
          <button
            type="button"
            onClick={() => setTab("edit")}
            title="Bewerken — HTML-editor en AI-chat"
            aria-label="Bewerken — HTML-editor en AI-chat"
            aria-pressed={tab === "edit"}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded transition-colors",
              tab === "edit"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            )}
          >
            <Pencil className="size-3.5 shrink-0" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setTab("generate")}
            title="Nieuwe generatie uit briefing"
            aria-label="Nieuwe generatie uit briefing"
            aria-pressed={tab === "generate"}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded transition-colors",
              tab === "generate"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            )}
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
          </button>
        </div>
        <GeneratorStudioFaqLauncher iconOnly />
        <div className="mx-1 min-w-0 flex-1">
          <StudioSupportStrip subfolderSlug={props.subfolderSlug} className="text-[10px]" />
        </div>
        <Link
          href={`/admin/clients/${encodeURIComponent(props.subfolderSlug)}/support`}
          title="Klantdossier — support"
          aria-label="Klantdossier — support"
          className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <FolderOpen className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {tab === "edit" ? (
          <SiteHtmlEditor
            key={`${props.subfolderSlug}:${props.draftUpdatedAt}`}
            subfolderSlug={props.subfolderSlug}
            initialName={props.initialName}
            initialDescription={props.initialDescription}
            initialStatus={props.initialStatus}
            initialSections={props.initialSections}
            initialConfig={props.initialConfig}
            initialPageType={props.initialPageType}
            initialCustomCss={props.initialCustomCss ?? ""}
            initialCustomJs={props.initialCustomJs ?? ""}
            initialLogoSet={props.initialLogoSet}
            initialContactSections={props.initialContactSections}
            initialMarketingPages={props.initialMarketingPages}
            appointmentsEnabled={props.appointmentsEnabled ?? true}
            webshopEnabled={props.webshopEnabled ?? true}
            initialSiteIr={props.initialSiteIr ?? null}
            draftPublicPreviewToken={props.draftPublicPreviewToken ?? null}
            initialTailwindCompiledCss={props.initialTailwindCompiledCss ?? null}
          />
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <GeneratorForm
              initialSubfolderSlug={props.subfolderSlug}
              initialClientName={props.initialName}
              initialClientDescription={props.initialDescription}
              existingDraftLocked={false}
              onSiteSaved={onSiteSaved}
              draftPublicPreviewToken={props.draftPublicPreviewToken ?? null}
              appointmentsEnabled={props.appointmentsEnabled ?? false}
              webshopEnabled={props.webshopEnabled ?? false}
              hideFaqLauncher
            />
          </div>
        )}
      </div>
    </div>
  );
}
