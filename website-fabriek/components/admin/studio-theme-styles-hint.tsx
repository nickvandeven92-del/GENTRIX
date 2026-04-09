"use client";

import { HelpCircle, X } from "lucide-react";
import { useCallback, useRef } from "react";

const THEMES: { label: string; keywords: string }[] = [
  { label: "Glassmorphism", keywords: "matglas, backdrop-blur, lichte randen, diepte, iOS-achtig" },
  { label: "Neumorphism", keywords: "zachte schaduw, extruded/inset, pastel, tactiel, subtiel contrast" },
  { label: "Minimal / Flat design", keywords: "vlak, weinig decoratie, veel witruimte, duidelijke typografie, functioneel" },
  { label: "Gradient / Vibrant design", keywords: "kleurverloop, energie, contrast, hero’s, call-to-actions" },
  { label: "Brutalism / Neo-brutalism", keywords: "harde randen, dikke type, rauw, hoog contrast, speels-breuk" },
  { label: "Cyberpunk / Futuristic", keywords: "neon, donker, tech, grid, glow, sci-fi sfeer" },
  { label: "Editorial / Luxury", keywords: "serif, ruime marges, mode/quality, rust, premium gevoel" },
  { label: "Skeuomorphism", keywords: "realistische texturen, 3D-illusie, bekende fysieke metaforen" },
  { label: "Bento UI", keywords: "tegels in raster, kaarten in vakken, Apple-achtige overzichten" },
  { label: "Cinematic / Immersive", keywords: "fullscreen beeld/video, dramatische typografie, weinig UI-ruis" },
  { label: "Mesh gradient / Soft gradient", keywords: "zachte kleurwolken, organisch, modern SaaS-landing" },
  { label: "Glass + Glow hybrid", keywords: "glas + lichtaccenten, premium tech, donkere achtergrond" },
  { label: "Swiss / International Style", keywords: "grid, sans-serif, objectief, rood/zwart/wit, streng" },
  { label: "Newspaper / Editorial classic", keywords: "kolommen, koppen, lead, krant/magazine-layout" },
  { label: "Modular UI", keywords: "herbruikbare blokken, kaarten, flexibel raster, schaalbaar" },
  { label: "Monochrome / Ultra minimal", keywords: "één kleurfamilie, extreem rustig, focus op inhoud" },
  { label: "Abstract / Experimental", keywords: "vormen, onverwachte layout, artistiek, minder conventies" },
  { label: "AI / Generative aesthetic", keywords: "organische patronen, gradient-noise, futuristisch, “tool”-gevoel" },
];

export type StudioThemeStylesHintProps = {
  /** `inline` = klein icoon naast een label (standaard). `floating` = grote cirkel in een paneelhoek. */
  variant?: "inline" | "floating";
};

export function StudioThemeStylesHint({ variant = "inline" }: StudioThemeStylesHintProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const triggerClass =
    variant === "inline"
      ? "inline-flex shrink-0 items-center justify-center rounded p-0.5 text-slate-400 transition-colors hover:text-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      : "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800";

  const iconClass = variant === "inline" ? "size-3.5" : "size-5";

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={triggerClass}
        aria-haspopup="dialog"
        aria-label="Beschikbare visuele stijlen en thema’s (keywords)"
        title="Welke stijlen kun je noemen in je briefing?"
      >
        <HelpCircle className={iconClass} aria-hidden />
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(100vw-1.5rem,520px)] max-h-[min(85vh,720px)] rounded-xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Stijlen voor je briefing</h2>
            <p className="mt-0.5 text-xs text-neutral-600">
              Noem 1–2 hoofdrichtingen in de omschrijving; het model vertaalt dat naar layout en kleuren binnen de vaste
              secties.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            aria-label="Sluiten"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ul className="space-y-2.5 text-sm">
            {THEMES.map(({ label, keywords }) => (
              <li key={label} className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">{label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-neutral-600">{keywords}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-xs leading-relaxed text-emerald-950">
            <p className="font-semibold text-emerald-900">Goed te combineren (zelfde “familie”)</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-emerald-900/90">
              <li>
                <strong>Minimal / Flat</strong> + <strong>Bento</strong> of <strong>Modular</strong> — typisch SaaS/ product.
              </li>
              <li>
                <strong>Swiss / International</strong> + <strong>Monochrome</strong> — strak, redactioneel.
              </li>
              <li>
                <strong>Mesh / Soft gradient</strong> + <strong>Gradient vibrant</strong> — één gradient-taal, niet alles tegelijk.
              </li>
              <li>
                <strong>Editorial / Luxury</strong> + <strong>Newspaper classic</strong> — magazine, fashion, premium content.
              </li>
              <li>
                <strong>Cinematic</strong> + <strong>Glass</strong> of <strong>Glass + Glow</strong> — hero-first, premium tech.
              </li>
            </ul>
          </div>

          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
            <p className="font-semibold text-amber-900">Combinaties die snel botsen</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-amber-900/90">
              <li>
                <strong>Neumorphism</strong> + <strong>hard flat / brutalism</strong> — tegenstrijdig tactiel vs. plat.
              </li>
              <li>
                <strong>Skeuomorphism</strong> + <strong>ultra-minimal Swiss</strong> — tenzij bewust “retro in strak grid”.
              </li>
              <li>
                <strong>Te veel effecten tegelijk</strong> (glas + neumorf + skeuo + neon) — kies één hoofdaccent.
              </li>
            </ul>
          </div>
        </div>
      </dialog>
    </>
  );
}
