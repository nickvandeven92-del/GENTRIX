import { describe, expect, it } from "vitest";
import { validateMarketingSiteHardRules } from "@/lib/ai/validate-marketing-site-output";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

function sec(id: string, html: string): TailwindSection {
  return { id, sectionName: id, html };
}

describe("validateMarketingSiteHardRules", () => {
  it("reject form on landing", () => {
    const errs = validateMarketingSiteHardRules([sec("hero", "<section><form></form></section>")], [
      sec("contact", "<section><p>x</p></section>"),
    ]);
    expect(errs.some((e) => e.includes("<form>"))).toBe(true);
  });

  it("reject contact without form", () => {
    const errs = validateMarketingSiteHardRules([sec("hero", "<section></section>")], [
      sec("contact", "<section><p>Geen formulier</p></section>"),
    ]);
    expect(errs.some((e) => e.toLowerCase().includes("form"))).toBe(true);
  });

  it("accept valid landing + contact", () => {
    const errs = validateMarketingSiteHardRules(
      [sec("hero", '<section><a href="__STUDIO_CONTACT_PATH__">Contact</a></section>')],
      [sec("contact", "<section><form method=\"post\"></form></section>")],
    );
    expect(errs).toEqual([]);
  });
});
