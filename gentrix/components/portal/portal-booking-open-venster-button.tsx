"use client";

import { ExternalLink } from "lucide-react";

type Props = {
  /** Absolute URL naar `/boek-venster/{slug}` op deze app. */
  href: string;
};

const POPUP_FEATURES =
  "width=440,height=860,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,status=no";

/**
 * Opent de boek-flow in een apart klein venster (shell-pagina met iframe), zonder ruimte op de eigen site.
 */
export function PortalBookingOpenVensterButton({ href }: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        window.open(href, "gentrix-boek-venster", `${POPUP_FEATURES},noopener,noreferrer`);
      }}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/40 sm:w-auto"
    >
      <ExternalLink className="size-4 shrink-0" aria-hidden />
      Open in klein venster
    </button>
  );
}
