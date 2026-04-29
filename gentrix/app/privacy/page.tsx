import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacybeleid | Gentrix",
  description: "Privacybeleid voor Gentrix Social Connect en portaldiensten.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 text-zinc-900">
      <h1 className="text-3xl font-semibold">Privacybeleid</h1>
      <p className="mt-4 text-sm text-zinc-700">
        Laatst bijgewerkt: {new Date().toLocaleDateString("nl-NL")}
      </p>

      <section className="mt-8 space-y-3 text-sm leading-6 text-zinc-800">
        <p>
          Gentrix verwerkt persoonsgegevens om het klantenportaal, websitebeheer en social-koppelingen
          (zoals Meta/Facebook/Instagram) te leveren.
        </p>
        <p>
          We verwerken alleen gegevens die nodig zijn voor authenticatie, support, facturatie en het tonen
          van gekoppelde social content. Gegevens worden niet verkocht aan derden.
        </p>
        <p>
          Voor verzoeken over inzage, correctie of verwijdering kun je contact opnemen via{" "}
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
