import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, HelpCircle } from "lucide-react";
import { USER_FAQ_NL, USER_FAQ_PDF_PATH } from "@/lib/admin/user-faq-nl";

export const metadata: Metadata = {
  title: "Veelgestelde vragen",
  description: "Antwoorden in gewone taal over portaal, boeken, websites en meer.",
};

export default function VeelgesteldeVragenPage() {
  const pdfHref = USER_FAQ_PDF_PATH;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <HelpCircle className="size-7 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            Veelgestelde vragen
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Korte uitleg zonder moeilijke woorden. Staat het hier niet bij, vraag het dan aan iemand die het systeem beheert.
          </p>
        </div>
        <a
          href={pdfHref}
          download
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
        >
          <Download className="size-4" aria-hidden />
          Download als PDF
        </a>
      </div>

      <p className="mb-8 text-xs text-zinc-500 dark:text-zinc-400">
        Zelfde tekst als in het PDF-bestand:{" "}
        <a href={pdfHref} className="font-medium text-violet-700 underline dark:text-violet-400">
          veelgestelde-vragen-gentrix.pdf
        </a>
        .
      </p>

      <div className="space-y-3">
        {USER_FAQ_NL.map((item, i) => (
          <details
            key={i}
            className="group rounded-xl border border-zinc-200 bg-white open:shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <summary className="cursor-pointer list-none px-4 py-3 pr-10 text-sm font-semibold text-zinc-900 marker:content-none dark:text-zinc-50 [&::-webkit-details-marker]:hidden">
              <span className="block">{item.question}</span>
            </summary>
            <div className="border-t border-zinc-100 px-4 py-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
              {item.answer}
            </div>
          </details>
        ))}
      </div>

      <section className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Technische details nodig?</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Voor wie de onderliggende instructies van de generator wil bekijken (niet nodig voor dagelijks werk):{" "}
          <Link
            href="/admin/prompt"
            className="inline-flex items-center gap-1 font-medium text-violet-700 underline dark:text-violet-400"
          >
            Generator-referentie
            <ExternalLink className="size-3.5 opacity-70" aria-hidden />
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
