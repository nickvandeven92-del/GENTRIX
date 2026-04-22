"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mapAuthErrorToDutch } from "@/lib/auth/auth-error-messages";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "/home";
  const next = nextRaw.startsWith("/") ? nextRaw : "/home";
  const authErr = searchParams.get("error");
  const authErrText =
    authErr === "auth_callback" || authErr === "auth_confirm"
      ? "De inloglink is ongeldig of verlopen. Vraag een nieuwe link aan via je contactpersoon of gebruik “Opnieuw versturen” in het dossier."
      : authErr === "config"
        ? "Authenticatie is niet geconfigureerd op deze omgeving."
        : authErr
          ? "Inloggen mislukt. Probeer opnieuw."
          : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
      if (signError) {
        setError(mapAuthErrorToDutch(signError.message));
        return;
      }
      await fetch("/api/auth/mfa-email/clear-cookie", { method: "POST" });
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          id="email"
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
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Wachtwoord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={cn(
            "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
            "focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20",
          )}
        />
      </div>
      {authErrText && (
        <p className="text-sm text-red-600" role="alert">
          {authErrText}
        </p>
      )}
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
        {loading ? "Bezig…" : "Inloggen"}
      </button>
    </form>
  );
}
