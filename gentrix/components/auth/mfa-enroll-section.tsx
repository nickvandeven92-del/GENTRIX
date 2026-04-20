"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type EnrolledFactor = {
  id: string;
  friendly_name?: string | null;
  status: "verified" | "unverified";
};

type Step = "idle" | "enrolling" | "verifying" | "done";

export function MfaEnrollSection() {
  const [factors, setFactors] = useState<EnrolledFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [step, setStep] = useState<Step>("idle");

  // Enroll state
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const all = [
        ...(data?.totp ?? []),
      ] as EnrolledFactor[];
      setFactors(all);
    } finally {
      setLoadingFactors(false);
    }
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function startEnroll() {
    setEnrollError(null);
    setCode("");
    setStep("enrolling");

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator-app",
    });

    if (error || !data) {
      setEnrollError(error?.message ?? "Inschrijven mislukt.");
      setStep("idle");
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setTotpSecret(data.totp.secret);
    setStep("verifying");
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setEnrollError(null);
    setVerifyLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !ch) {
        setEnrollError(chErr?.message ?? "Challenge mislukt.");
        return;
      }

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.replace(/\s/g, ""),
      });

      if (vErr) {
        setEnrollError(vErr.message);
        return;
      }

      setStep("done");
      await loadFactors();
    } finally {
      setVerifyLoading(false);
    }
  }

  async function cancelEnroll() {
    if (factorId) {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setStep("idle");
    setFactorId(null);
    setQrCode(null);
    setTotpSecret(null);
    setCode("");
    setEnrollError(null);
  }

  async function removeFactor(id: string) {
    setRemoveError(null);
    setRemoveLoadingId(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) {
        setRemoveError(error.message);
        return;
      }
      await loadFactors();
    } finally {
      setRemoveLoadingId(null);
    }
  }

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasMfa = verifiedFactors.length > 0;

  // -------------------------------------------------------------------------
  // Stap 1: overzicht
  // -------------------------------------------------------------------------
  if (step === "idle" || step === "done") {
    return (
      <div className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              hasMfa
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800",
            )}
          >
            {hasMfa ? "Ingeschakeld" : "Niet ingeschakeld"}
          </span>
          {step === "done" && (
            <span className="text-xs text-green-700 font-medium">
              MFA succesvol ingesteld.
            </span>
          )}
        </div>

        {/* Actieve factoren */}
        {loadingFactors ? (
          <p className="text-sm text-zinc-500">Laden…</p>
        ) : hasMfa ? (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
            {verifiedFactors.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-zinc-900">
                    {f.friendly_name ?? "Authenticator-app"}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">{f.id.slice(0, 8)}…</p>
                </div>
                <button
                  onClick={() => void removeFactor(f.id)}
                  disabled={removeLoadingId === f.id}
                  className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {removeLoadingId === f.id ? "Verwijderen…" : "Verwijderen"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600">
            Je hebt nog geen authenticator-app gekoppeld. Na het instellen is een code uit je app
            verplicht bij elke login op het CRM.
          </p>
        )}

        {removeError && (
          <p className="text-sm text-red-600" role="alert">
            {removeError}
          </p>
        )}

        {/* Knop */}
        <button
          onClick={() => void startEnroll()}
          className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-950"
        >
          Authenticator-app koppelen
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Stap 2: QR-code scannen
  // -------------------------------------------------------------------------
  if (step === "verifying") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-zinc-700">
          <strong>Stap 1.</strong> Open je authenticator-app (Google Authenticator, Authy, 1Password, …) en scan de QR-code.
        </p>

        {/* QR code — Supabase geeft een SVG-string terug */}
        {qrCode && (
          <div
            className="flex justify-center rounded-xl border border-zinc-200 bg-white p-4"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Supabase-gegenereerde SVG
            dangerouslySetInnerHTML={{ __html: qrCode }}
          />
        )}

        {/* Handmatige invoer */}
        {totpSecret && (
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer select-none font-medium text-zinc-700">
              Kan de QR-code niet scannen? Voer de code handmatig in.
            </summary>
            <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 font-mono tracking-widest text-zinc-700 break-all select-all">
              {totpSecret}
            </p>
          </details>
        )}

        <p className="text-sm text-zinc-700">
          <strong>Stap 2.</strong> Vul de 6-cijferige code uit je app in ter bevestiging.
        </p>

        <form onSubmit={(e) => void verifyEnroll(e)} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest text-zinc-900",
              "focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20",
            )}
          />
          {enrollError && (
            <p className="text-sm text-red-600" role="alert">
              {enrollError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={verifyLoading || code.replace(/\s/g, "").length < 6}
              className="flex-1 rounded-lg bg-blue-900 py-2 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-50"
            >
              {verifyLoading ? "Controleren…" : "Bevestigen en activeren"}
            </button>
            <button
              type="button"
              onClick={() => void cancelEnroll()}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
