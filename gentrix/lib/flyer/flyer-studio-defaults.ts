import {
  flyerStudioPersistedSchema,
  type FlyerPdfTemplateId,
  type FlyerStudioPersisted,
} from "@/lib/flyer/flyer-studio-schema";

export type ResolvedFlyerCopy = {
  badge: string;
  headline: string;
  headlineHighlight: string;
  body: string;
};

/** Vult lege velden met standaarden voor het gekozen PDF-template. */
export function resolveFlyerCopyForPdf(
  template: FlyerPdfTemplateId,
  studio: FlyerStudioPersisted | null,
): ResolvedFlyerCopy {
  const d = defaultFlyerCopyForTemplate(template);
  const s = studio ?? flyerStudioPersistedSchema.parse({});
  return {
    badge: s.badge.trim() || d.badge,
    headline: s.headline.trim() || d.headline,
    headlineHighlight: (s.headlineHighlight ?? "").trim() || (d.headlineHighlight ?? "").trim(),
    body: s.body.trim() || d.body,
  };
}

/** Vaste NL-copy per layout-stijl (startpunt voor de editor). */
export function defaultFlyerCopyForTemplate(template: FlyerPdfTemplateId): Omit<FlyerStudioPersisted, "presets"> {
  if (template === "minimal") {
    return {
      pdfTemplate: "minimal",
      badge: "CONCEPTWEBSITE",
      headline: "Scan en bekijk direct online",
      headlineHighlight: "",
      body: "Richt je camera op de QR-code. Je ziet meteen een voorbeeld in de browser — geen app nodig. Daarna kun je een gesprek plannen of een offerte vragen.",
    };
  }
  if (template === "modern") {
    return {
      pdfTemplate: "modern",
      badge: "CONCEPTWEBSITE",
      headline: "Scan en bekijk direct online",
      headlineHighlight: "",
      body: "Richt je camera op de QR-code. Je ziet meteen een voorbeeld in de browser — geen app nodig. Daarna kun je een gesprek plannen of een offerte vragen.",
    };
  }
  return {
    pdfTemplate: "gentrix",
    badge: "WEBSITE ALS ABONNEMENT",
    headline: "Gevonden worden",
    headlineHighlight: "zonder gedoe.",
    body: "Professionele website voor een vast bedrag per maand. Jij richt je op je bedrijf — wij zorgen dat je online zichtbaar bent. Scan de QR-code voor een live voorbeeld.",
  };
}
