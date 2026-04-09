"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  dealId: string;
  companyName: string;
  clientSlug: string | null;
  contactEmail: string | null;
};

export function DealCardQuickActions({ dealId, companyName, clientSlug, contactEmail }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"remind" | null>(null);

  async function addReminder48h() {
    setBusy("remind");
    try {
      const due = new Date(Date.now() + 48 * 3_600_000).toISOString();
      const res = await fetch("/api/admin/sales-os/tasks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Deal: ${companyName}`,
          linked_entity_type: "deal",
          linked_entity_id: dealId,
          priority: "normal",
          due_at: due,
          source_type: "rule",
        }),
      });
      const j = (await res.json()) as { ok?: boolean };
      if (j.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const mailHref =
    contactEmail && contactEmail.includes("@")
      ? `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(`Sales OS — ${companyName}`)}`
      : null;

  const btn =
    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors ring-1 ring-neutral-950/[0.08] hover:bg-neutral-50";

  return (
    <div className="mt-2 flex flex-wrap gap-1 border-t border-neutral-100 pt-2">
      <Link
        href={`/admin/ops/deals/${encodeURIComponent(dealId)}`}
        className={cn(btn, "text-neutral-800")}
      >
        Dossier
      </Link>
      {clientSlug ? (
        <Link
          href={`/admin/ops/clients/${encodeURIComponent(clientSlug)}`}
          className={cn(btn, "text-neutral-800")}
        >
          Klant
        </Link>
      ) : null}
      {mailHref ? (
        <a href={mailHref} className={cn(btn, "text-neutral-800")}>
          Mail
        </a>
      ) : null}
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void addReminder48h()}
        className={cn(btn, busy !== null && "opacity-50")}
        title="Open taak met deadline over 48 uur"
      >
        {busy === "remind" ? "…" : "+48u"}
      </button>
    </div>
  );
}
