import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Algemene voorwaarden | Gentrix",
  description: "Algemene voorwaarden voor het gebruik van Gentrix diensten.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 text-zinc-900">
      <h1 className="text-3xl font-semibold">Algemene voorwaarden</h1>
      <p className="mt-4 text-sm text-zinc-700">
        Deze voorwaarden zijn van toepassing op het gebruik van Gentrix diensten, waaronder het
        klantenportaal, websitebeheer en social-koppelingen.
      </p>

      <section className="mt-8 space-y-3 text-sm leading-6 text-zinc-800">
        <p>
          Door gebruik te maken van Gentrix ga je akkoord met verantwoord gebruik van het platform en
          naleving van toepasselijke wet- en regelgeving.
        </p>
        <p>
          Misbruik, ongeautoriseerde toegang of gebruik in strijd met de wet kan leiden tot beperking of
          beëindiging van toegang.
        </p>
        <p>
          Voor vragen over voorwaarden kun je contact opnemen via{" "}
          <a className="underline" href="mailto:info@gentrix.nl">
            info@gentrix.nl
          </a>
          .
        </p>
      </section>

      <div className="mt-10">
        <Link href="/" className="text-sm underline">
          Terug naar homepage
        </Link>
      </div>
    </main>
  );
}
