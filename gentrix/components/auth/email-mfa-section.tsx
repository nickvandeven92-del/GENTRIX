"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "loading" | "enabled" | "disabled" | "toggling" | "error";

export function EmailMfaSection() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/mfa-email/status");
      const json = (await res.json()) as { enabled?: boolean; error?: string };
      if (!res.ok) {
        setErrorMsg(json.error ?? "Kon status niet ophalen.");
        setStatus("error");
        return;
      }
      setStatus(json.enabled ? "enabled" : "disabled");
    } catch {
      setErrorMsg("Netwerkfout.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    const enabling = status === "disabled";
    setStatus("toggling");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/mfa-email/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: enabling }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Kon instelling niet wijzigen.");
        setStatus(enabling ? "disabled" : "enabled");
        return;
      }
      setStatus(enabling ? "enabled" : "disabled");
    } catch {
      setErrorMsg("Netwerkfout.");
      setStatus(enabling ? "disabled" : "enabled");
    }
  }

  const isEnabled = status === "enabled";
  const busy = status === "loading" || status === "toggling";

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        {status === "loading" ? (
          <p className="text-sm text-zinc-500">Laden…</p>
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              isEnabled ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800",
            )}
          >
            {isEnabled ? "Ingeschakeld" : "Niet ingeschakeld"}
          </span>
        )}
      </div>

      {isEnabled && (
        <p className="text-sm text-zinc-600">
          Bij elke login ontvang je een 6-cijferige code per e-mail. Voer die in om toegang te krijgen.
        </p>
      )}

      {!isEnabled && status !== "loading" && (
        <p className="text-sm text-zinc-600">
          Schakel in om bij elke login een code per e-mail te ontvangen. Je hebt geen app nodig.
        </p>
      )}

      {errorMsg && (
        <p className="text-sm text-red-600" role="alert">
          {errorMsg}
        </p>
      )}

      {status !== "loading" && (
        <button
          onClick={() => void toggle()}
          disabled={busy}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50",
            isEnabled
              ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              : "bg-blue-900 text-white hover:bg-blue-950",
          )}
        >
          {status === "toggling"
            ? "Bezig…"
            : isEnabled
              ? "E-mail MFA uitschakelen"
              : "E-mail MFA inschakelen"}
        </button>
      )}
    </div>
  );
}
