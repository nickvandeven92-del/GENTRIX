import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PUBLIC_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Wachtwoord vergeten",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-white p-8 shadow-xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-blue-900">
          {PUBLIC_BRAND}
        </p>
        <h1 className="mt-2 text-center text-xl font-semibold text-slate-900">
          Wachtwoord vergeten
        </h1>
        <p className="mt-1 text-center text-sm text-slate-600">
          Vul je e-mailadres in. Als het bij ons bekend is, sturen we je een reset-link.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-center text-sm text-slate-500">Laden…</p>}>
            <ForgotPasswordForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/login" className="text-blue-800 hover:underline">
            Terug naar inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
