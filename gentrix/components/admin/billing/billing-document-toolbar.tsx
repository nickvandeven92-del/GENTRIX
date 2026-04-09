"use client";

import Link from "next/link";

type Props = {
  listHref: string;
  editHref: string;
  listLabel: string;
};

export function BillingDocumentToolbar({ listHref, editHref, listLabel }: Props) {
  function printDoc() {
    window.print();
  }

  return (
    <div className="billing-no-print mb-8 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4 print:hidden">
      <Link href={listHref} className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900">
        ← {listLabel}
      </Link>
      <span className="text-neutral-300" aria-hidden>
        |
      </span>
      <Link
        href={editHref}
        className="sales-os-glass-outline-btn rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-900 hover:bg-neutral-50"
      >
        Bewerken
      </Link>
      <button
        type="button"
        onClick={() => printDoc()}
        className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-950 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800"
      >
        Afdrukken
      </button>
      <button
        type="button"
        onClick={() => printDoc()}
        title="Kies in het afdrukvenster: ‘PDF opslaan’ of ‘Microsoft Print to PDF’."
        className="sales-os-glass-outline-btn rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-800 hover:bg-neutral-50"
      >
        Opslaan als PDF
      </button>
      <p className="w-full text-[11px] leading-snug text-neutral-500 lg:ml-auto lg:w-auto lg:max-w-md">
        Tip: gebruik <strong className="font-medium text-neutral-700">Afdrukken</strong> en kies in het systeemvenster{" "}
        <strong className="font-medium text-neutral-700">Opslaan als PDF</strong> (of “Microsoft Print to PDF”).
      </p>
    </div>
  );
}
