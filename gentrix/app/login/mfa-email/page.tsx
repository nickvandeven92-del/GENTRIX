import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmailMfaVerifyForm } from "@/components/auth/email-mfa-verify-form";
import { PUBLIC_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Twee-stapsverificatie",
  robots: { index: false, follow: false },
};

export default function LoginMfaEmailPage() {
  return (
    <div className="w-full max-w-sm border border-neutral-200 bg-white p-8 shadow-sm">
      <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {PUBLIC_BRAND}
      </p>
      <h1 className="mt-2 text-center text-base font-semibold tracking-tight text-neutral-900">Twee-stapsverificatie</h1>
      <p className="mt-1 text-center text-xs text-neutral-500">Er is een 6-cijferige code naar je e-mailadres gestuurd.</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-center text-xs text-neutral-500">Laden…</p>}>
          <EmailMfaVerifyForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-xs text-neutral-500">
        <Link href="/login" className="font-medium text-neutral-900 underline underline-offset-2 hover:no-underline">
          Andere account
        </Link>
      </p>
    </div>
  );
}
