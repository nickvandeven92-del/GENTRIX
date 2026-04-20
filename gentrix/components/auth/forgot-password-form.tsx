"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/wachtwoord-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok && res.status !== 200) {
        setError("Er is iets misgegaan. Probeer het opnieuw.");
        return;
      }
      setDone(true);
    } catch {
      setError("Geen verbinding. Controleer je internet en probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-medium">Controleer je inbox</p>
        <p className="mt-1 text-green-700">
          Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een link om je
          wachtwoord opnieuw in te stellen.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="fp-email" className="block text-sm font-medium text-slate-700">
          E-mailadres
        </label>
        <input
          id="fp-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {loading ? "Bezig…" : "Reset-link versturen"}
      </button>
    </form>
  );
}
