import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { PUBLIC_BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Inloggen",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm border border-neutral-200 bg-white p-8 shadow-sm">
      <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {PUBLIC_BRAND}
      </p>
      <h1 className="mt-2 text-center text-base font-semibold tracking-tight text-neutral-900">Inloggen</h1>
      <p className="mt-1 text-center text-xs text-neutral-500">Studio-team en klanten met een uitnodiging.</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-center text-xs text-neutral-500">Laden…</p>}>
          <LoginForm />
        </Suspense>
      </div>
      <details className="mt-6 border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-600">
        <summary className="cursor-pointer font-medium text-neutral-800">Klant met nieuwe website?</summary>
        <p className="mt-2 leading-relaxed">
          Je hoeft je niet zelf te registreren. Je ontvangt een e-mail met je e-mailadres als gebruikersnaam en een link om een
          wachtwoord te kiezen. Daarna log je hier in met dat e-mailadres en wachtwoord.
        </p>
      </details>
      <details className="mt-3 border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-600">
        <summary className="cursor-pointer font-medium text-neutral-800">Team: eerste keer / handmatig account</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
          <li>
            Open je project in het{" "}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-900 underline underline-offset-2 hover:no-underline"
            >
              Supabase-dashboard
            </a>
            .
          </li>
          <li>
            Ga naar <strong>Authentication</strong> → <strong>Users</strong> → <strong>Add user</strong> →{" "}
            <strong>Create new user</strong>.
          </li>
          <li>Vul hetzelfde e-mailadres en een wachtwoord in als hier op de loginpagina.</li>
          <li>
            Lokaal testen: onder <strong>Authentication</strong> → <strong>Providers</strong> → <strong>Email</strong>{" "}
            kun je <strong>Confirm email</strong> uitzetten, zodat je geen bevestigingsmail nodig hebt.
          </li>
          <li>Log daarna opnieuw in op deze pagina.</li>
        </ol>
      </details>
      <p className="mt-6 text-center text-xs text-neutral-500">
        <Link href="/wachtwoord-vergeten" className="font-medium text-neutral-900 underline underline-offset-2 hover:no-underline">
          Wachtwoord vergeten?
        </Link>
        {" · "}
        <Link href="/" className="font-medium text-neutral-900 underline underline-offset-2 hover:no-underline">
          Terug naar website
        </Link>
      </p>
    </div>
  );
}
