"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles } from "lucide-react";
import { GeneratorForm } from "@/components/admin/generator-form";
import { GeneratorStudioFaqLauncher } from "@/components/admin/generator-studio-faq-launcher";
import { SiteHtmlEditor } from "@/components/admin/site-html-editor";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { SnapshotPageType } from "@/lib/site/snapshot-page-type";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { cn } from "@/lib/utils";

type Tab = "edit" | "generate";

export type StudioTailwindWorkspaceProps = {
  subfolderSlug: string;
  initialName: string;
  initialDescription: string | null;
  initialStatus: "draft" | "active" | "paused" | "archived";
  initialSections: TailwindSection[];
  initialConfig: TailwindPageConfig | null | undefined;
  initialPageType?: SnapshotPageType;
  initialCustomCss?: string;
  initialCustomJs?: string;
  initialLogoSet?: GeneratedLogoSet;
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
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "edit"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            <Pencil className="size-3.5 shrink-0" aria-hidden />
            Bewerken
          </button>
          <button
            type="button"
            onClick={() => setTab("generate")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "generate"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Nieuwe generatie
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Bewerken of nieuwe generatie — zelfde plek.
        </p>
        <GeneratorStudioFaqLauncher className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800" />
        <Link
          href={`/admin/clients/${encodeURIComponent(props.subfolderSlug)}`}
          className="ml-auto text-xs font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
        >
          Klantdossier →
        </Link>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {tab === "edit" ? (
          <SiteHtmlEditor
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
            appointmentsEnabled={props.appointmentsEnabled ?? true}
            webshopEnabled={props.webshopEnabled ?? true}
            initialSiteIr={props.initialSiteIr ?? null}
            draftPublicPreviewToken={props.draftPublicPreviewToken ?? null}
            initialTailwindCompiledCss={props.initialTailwindCompiledCss ?? null}
          />
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
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
