"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function MfaVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "/home";
  const next = nextRaw.startsWith("/") ? nextRaw : "/home";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initChallenge() {
      const supabase = createSupabaseBrowserClient();
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listErr) {
        setInitError(listErr.message);
        return;
      }
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        setInitError("Geen geverifieerde authenticator-app gekoppeld. Stel MFA in onder Instellingen.");
        return;
      }
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (cancelled) return;
      if (chErr || !ch) {
        setInitError(chErr?.message ?? "Challenge mislukt.");
        return;
      }
      setFactorId(totp.id);
      setChallengeId(ch.id);
    }
    void initChallenge();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: code.replace(/\s/g, ""),
      });
      if (vErr) {
        setError(vErr.message);
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (initError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {initError}
      </p>
    );
  }

  if (!factorId || !challengeId) {
    return <p className="text-sm text-slate-600">Authenticator uitdaging voorbereiden…</p>;
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="mfa" className="block text-sm font-medium text-slate-700">
          Code uit je authenticator-app
        </label>
        <input
          id="mfa"
          name="mfa"
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
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-900 py-2.5 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-60"
      >
        {loading ? "Controleren…" : "Verifiëren"}
      </button>
    </form>
  );
}
