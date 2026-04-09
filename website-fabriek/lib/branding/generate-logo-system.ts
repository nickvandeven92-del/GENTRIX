import { generateLogoCandidatesWithClaude } from "@/lib/ai/generate-logo-candidates";
import { pickBestCandidateId, scoreLogoCandidates } from "@/lib/ai/score-logo-candidates";
import { renderFinalLogoSet } from "@/lib/branding/render-logo-svg";
import { generatedLogoSetSchema, type GeneratedLogoSet } from "@/types/logo";

function minifySvgOneLine(svg: string): string {
  return svg.replace(/\s+/g, " ").trim();
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function buildBrandLogoPromptAppendix(logo: GeneratedLogoSet): string {
  const p = minifySvgOneLine(logo.variants.primary);
  const l = minifySvgOneLine(logo.variants.light);
  const d = minifySvgOneLine(logo.variants.dark);
  const ic = minifySvgOneLine(logo.variants.icon);
  const data = (svg: string) => encodeURIComponent(svg);
  const alt = escapeHtmlAttr(logo.brandName);

  return `=== PREMIUM MERKMARK (verplicht — niet vervangen door Lucide/emoji/random "logo") ===

Deze site heeft een **vaststaande SVG-merkset**. Gebruik ze **letterlijk** in de eerste sectie (hero/header) en in de footer.

**1) Header / hero op licht vlak** — inline SVG (voorkeur) of img:
\`\`\`html
${p}
\`\`\`
Alternatief img: \`<img alt="${alt}" class="h-8 w-auto md:h-9 shrink-0" src="data:image/svg+xml,${data(p)}" width="200" height="40" />\`

**2) Lichte achtergrond, donkere inkt** (subtiele navbar op wit):
\`\`\`html
${l}
\`\`\`

**3) Donkere footer / donkere hero-overlay** (lichtere inkt):
\`\`\`html
${d}
\`\`\`

**4) Compact menu / avatar-achtig icoon** (alleen het teken):
\`\`\`html
${ic}
\`\`\`

Regels:
- Geen extra drop-shadows, filters, gradients of 3D op deze merk-SVG's.
- Behoud aspect ratio (\`w-auto h-8\` of \`h-9\`); niet rekken.
- Gebruik **niet** tegelijk een ander fictief logo naast deze set.
- Zet op de **directe wrapper** rond het merk (div of a) het attribuut \`data-studio-brand-mark="1"\` zodat de studio weet dat het logo aanwezig is.
- \`aria-label\` op link-wrapper rond het logo: "${alt}".

Gebruiknotities: ${logo.metadata.usageNotes.join(" ")}`;
}

/**
 * Logo-pipeline is tijdelijk uitgeschakeld na de AI engine reset.
 * De functie heeft de oude prompt-pipeline nodig (buildBrandIdentity, enz.).
 * Herbouw deze wanneer de nieuwe pipeline klaar is.
 */
export async function runPremiumLogoPipeline(_input: {
  businessName: string;
  description: string;
  [key: string]: unknown;
}): Promise<{ ok: true; data: GeneratedLogoSet } | { ok: false; error: string }> {
  return { ok: false, error: "Logo-pipeline uitgeschakeld (AI engine reset — nog niet herbouwd)." };
}
