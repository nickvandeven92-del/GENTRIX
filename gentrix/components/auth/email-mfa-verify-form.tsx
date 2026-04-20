"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Phase = "sending" | "waiting" | "verifying" | "error";

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
      const res = await fetch("/api/auth/mfa-email/send", { method: "POST" });
      const json = (await res.json()) as { codeId?: string; error?: string };
      if (!res.ok || !json.codeId) {
        setError(json.error ?? "Kon code niet versturen.");
        setPhase("error");
        return;
      }
      setCodeId(json.codeId);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeId, code: code.replace(/\s/g, "") }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Verificatie mislukt.");
        setPhase("waiting");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
      setPhase("waiting");
    }
  }

  if (phase === "sending") {
    return <p className="text-center text-sm text-slate-500">Code versturen…</p>;
  }

  if (phase === "error" && !codeId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
        <button
          onClick={() => void sendCode()}
          className="w-full rounded-lg bg-blue-900 py-2.5 text-sm font-medium text-white hover:bg-blue-950"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="mfa-email-code" className="block text-sm font-medium text-slate-700">
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
            "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest text-slate-900",
            "focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20",
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
        className="w-full rounded-lg bg-blue-900 py-2.5 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-60"
      >
        {phase === "verifying" ? "Controleren…" : "Verifiëren"}
      </button>

      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-xs text-slate-400">
            Nieuwe code aanvragen kan over {resendCooldown}s
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void sendCode()}
            className="text-xs text-blue-800 hover:underline"
          >
            Geen code ontvangen? Stuur opnieuw
          </button>
        )}
      </div>
    </form>
  );
}
