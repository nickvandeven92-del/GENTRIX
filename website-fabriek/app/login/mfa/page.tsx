import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MfaVerifyForm } from "@/components/auth/mfa-verify-form";
import { PUBLIC_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Twee-stapsverificatie",
  robots: { index: false, follow: false },
};

export default function LoginMfaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-white p-8 shadow-xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-blue-900">
          {PUBLIC_BRAND}
        </p>
        <h1 className="mt-2 text-center text-xl font-semibold text-slate-900">Twee-stapsverificatie</h1>
        <p className="mt-1 text-center text-sm text-slate-600">Voer de 6-cijferige code van je app in.</p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-center text-sm text-slate-500">Laden…</p>}>
            <MfaVerifyForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/login" className="text-blue-800 hover:underline">
            Andere account
          </Link>
        </p>
      </div>
    </div>
  );
}
