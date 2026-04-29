import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion | Gentrix",
  description: "Instructies voor het verwijderen van persoonsgegevens bij Gentrix.",
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 text-zinc-900">
      <h1 className="text-3xl font-semibold">Data Deletion Instructions</h1>
      <p className="mt-4 text-sm text-zinc-700">
        Verzoeken voor gegevensverwijdering kun je sturen naar{" "}
        <a className="underline" href="mailto:info@gentrix.nl">
          info@gentrix.nl
        </a>
        .
      </p>

      <section className="mt-8 space-y-3 text-sm leading-6 text-zinc-800">
        <p>Vermeld in je verzoek:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Je naam en e-mailadres waarmee je bent geregistreerd.</li>
          <li>Eventuele bedrijfsnaam of portal-url.</li>
          <li>Dat het om een data deletion request gaat.</li>
        </ul>
        <p>
          We bevestigen ontvangst en verwerken het verzoek binnen een redelijke termijn volgens geldende
          wet- en regelgeving.
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
