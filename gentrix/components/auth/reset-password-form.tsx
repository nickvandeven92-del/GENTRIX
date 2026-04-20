"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens bevatten.");
      return;
    }
    if (password !== confirm) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message ?? "Er is iets misgegaan. Probeer opnieuw.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-medium">Wachtwoord opgeslagen</p>
        <p className="mt-1 text-green-700">Je wordt doorgestuurd naar de inlogpagina…</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="rp-password" className="block text-sm font-medium text-slate-700">
          Nieuw wachtwoord
        </label>
        <input
          id="rp-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={cn(
            "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
            "focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20",
          )}
        />
      </div>
      <div>
        <label htmlFor="rp-confirm" className="block text-sm font-medium text-slate-700">
          Herhaal wachtwoord
        </label>
        <input
          id="rp-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={cn(
            "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
            "focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20",
          )}
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
        {loading ? "Opslaan…" : "Wachtwoord opslaan"}
      </button>
    </form>
  );
}
