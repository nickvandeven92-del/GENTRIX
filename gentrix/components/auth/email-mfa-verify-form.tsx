"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { salesOsPrimaryButtonClass, salesOsTextInputClass } from "@/lib/sales-os/ui-classes";
import { cn } from "@/lib/utils";

type Phase = "sending" | "waiting" | "verifying" | "error";

async function parseApiJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function EmailMfaVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "/home";
  const next = nextRaw.startsWith("/") ? nextRaw : "/home";

  const [phase, setPhase] = useState<Phase>("sending");
  const [codeId, setCodeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendCode = useCallback(async () => {
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa-email/send", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await parseApiJson(res);
      const codeId = typeof json?.codeId === "string" ? json.codeId : undefined;
      const errMsg = typeof json?.error === "string" ? json.error : undefined;
      if (!res.ok || !codeId) {
        setError(errMsg ?? `Kon code niet versturen (${res.status}).`);
        setPhase("error");
        return;
      }
      setCodeId(codeId);
      setPhase("waiting");
      setResendCooldown(60);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cooldownRef.current = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            clearInterval(cooldownRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void sendCode();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [sendCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codeId) return;
    setError(null);
    setPhase("verifying");
    try {
      const res = await fetch("/api/auth/mfa-email/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeId, code: code.replace(/\s/g, "") }),
      });
      const json = await parseApiJson(res);
      const ok = json?.ok === true;
      const errMsg = typeof json?.error === "string" ? json.error : undefined;
      if (!json) {
        setError(`Serverfout (${res.status}). Probeer opnieuw of vraag een nieuwe code aan.`);
        setPhase("waiting");
        return;
      }
      if (!res.ok || !ok) {
        setError(errMsg ?? "Verificatie mislukt.");
        setPhase("waiting");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Netwerkfout. Controleer je verbinding en probeer opnieuw.");
      setPhase("waiting");
    }
  }

  if (phase === "sending") {
    return <p className="text-center text-sm text-neutral-500">Code versturen…</p>;
  }

  if (phase === "error" && !codeId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void sendCode()}
          className={salesOsPrimaryButtonClass}
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="mfa-email-code" className="block text-xs font-medium text-neutral-700">
          Code uit je e-mail
        </label>
        <input
          id="mfa-email-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={cn(
            "mt-1 text-center font-mono text-lg tracking-widest",
            salesOsTextInputClass(),
          )}
          placeholder="000000"
          maxLength={6}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={phase === "verifying" || code.replace(/\s/g, "").length < 6}
        className={salesOsPrimaryButtonClass}
      >
        {phase === "verifying" ? "Controleren…" : "Verifiëren"}
      </button>

      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-xs text-neutral-400">
            Nieuwe code aanvragen kan over {resendCooldown}s
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void sendCode()}
            className="text-xs font-medium text-neutral-900 underline underline-offset-2 hover:no-underline"
          >
            Geen code ontvangen? Stuur opnieuw
          </button>
        )}
      </div>
    </form>
  );
}
