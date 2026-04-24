import { describe, expect, it } from "vitest";
import { postProcessClaudeTailwindPage, STUDIO_FLOATING_WHATSAPP_SECTION_ID } from "@/lib/ai/generate-site-postprocess";
import { sanitizeTailwindFragment } from "@/lib/site/tailwind-page-html";
import type { ClaudeTailwindPageOutput } from "@/lib/ai/tailwind-sections-schema";
import { STUDIO_CONTACT_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

const minimalConfig: ClaudeTailwindPageOutput["config"] = {
  style: "test",
  font: "Inter, sans-serif",
  theme: { primary: "#0f172a", accent: "#ea580c" },
};

describe("floating WhatsApp launcher (postprocess)", () => {
  it("voegt zwevende knop toe met wa.me uit bestaande link", () => {
    const page: ClaudeTailwindPageOutput = {
      config: minimalConfig,
      sections: [
        { id: "hero", html: `<section id="hero"><a href="https://wa.me/31612345678">App</a></section>` },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    const last = out.sections[out.sections.length - 1];
    expect(last?.id).toBe(STUDIO_FLOATING_WHATSAPP_SECTION_ID);
    expect(last?.html).toContain("https://wa.me/31612345678");
    expect(last?.html).toContain("data-gentrix-floating-whatsapp");
    expect(sanitizeTailwindFragment(last!.html)).toContain("data-gentrix-floating-whatsapp");
  });

  it("gebruikt tel: om wa.me af te leiden", () => {
    const page: ClaudeTailwindPageOutput = {
      config: minimalConfig,
      sections: [{ id: "cta", html: `<a href="tel:+31698765432">Bel</a>` }],
    };
    const out = postProcessClaudeTailwindPage(page);
    const last = out.sections[out.sections.length - 1];
    expect(last?.html).toContain("https://wa.me/31698765432");
  });

  it("valt terug op contact-placeholder zonder nummer in HTML", () => {
    const page: ClaudeTailwindPageOutput = {
      config: minimalConfig,
      sections: [{ id: "hero", html: `<section id="hero"><p>Geen link</p></section>` }],
    };
    const out = postProcessClaudeTailwindPage(page);
    const last = out.sections[out.sections.length - 1];
    expect(last?.html).toContain(STUDIO_CONTACT_PATH_PLACEHOLDER);
  });

  it("voegt niet toe als model al data-gentrix-floating-whatsapp heeft", () => {
    const page: ClaudeTailwindPageOutput = {
      config: minimalConfig,
      sections: [
        {
          id: "custom",
          html: `<div data-gentrix-floating-whatsapp="1"><a href="https://wa.me/31">x</a></div>`,
        },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    expect(out.sections.some((s) => s.id === STUDIO_FLOATING_WHATSAPP_SECTION_ID)).toBe(false);
  });
});
