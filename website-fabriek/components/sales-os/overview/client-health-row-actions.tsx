"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  clientId: string;
  clientName: string;
  billingEmail: string | null;
  slug: string;
};

export function ClientHealthRowActions({ clientId, clientName, billingEmail, slug }: Props) {
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
          title: `Follow-up: ${clientName}`,
          linked_entity_type: "client",
          linked_entity_id: clientId,
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
    billingEmail && billingEmail.includes("@")
      ? `mailto:${encodeURIComponent(billingEmail)}?subject=${encodeURIComponent(`Sales OS — ${clientName}`)}`
      : null;

  const btn =
    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors ring-1 ring-neutral-950/[0.08] hover:bg-neutral-50";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Link
        href={`/admin/ops/clients/${encodeURIComponent(slug)}`}
        className="text-[11px] font-medium text-neutral-950 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-950"
      >
        Openen
      </Link>
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void addReminder48h()}
          className={cn(btn, busy !== null && "opacity-50")}
          title="Open taak met deadline over 48 uur"
        >
          {busy === "remind" ? "…" : "+48u taak"}
        </button>
        {mailHref ? (
          <a href={mailHref} className={btn}>
            Mail
          </a>
        ) : null}
      </div>
    </div>
  );
}
