"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  subfolderSlug: string;
  clientName: string;
  onSuccess?: () => void;
};

export function DeleteClientButton({ subfolderSlug, clientName, onSuccess }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        `Site “${clientName}” (${subfolderSlug}) permanent verwijderen uit Supabase? Dit kan niet ongedaan worden gemaakt.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? "Verwijderen mislukt.");
        return;
      }
      onSuccess?.();
      router.refresh();
    } catch {
      window.alert("Netwerkfout bij verwijderen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-800",
        "hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40",
      )}
    >
      <Trash2 className="size-3.5" aria-hidden />
      {loading ? "…" : "Verwijderen"}
    </button>
  );
}
