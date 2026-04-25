import { describe, expect, it } from "vitest";
import type { MasterPromptPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  resolveStudioNavUnderShellPolicy,
  validateStudioShellNavConfig,
} from "@/lib/site/studio-shell-nav-policy";

const shellMaster = (studioNav?: MasterPromptPageConfig["studioNav"]): MasterPromptPageConfig => ({
  style: "T",
  theme: { primary: "#000", accent: "#fff" },
  font: "Inter, system-ui, sans-serif",
  studioShellNav: true,
  ...(studioNav ? { studioNav } : {}),
});

describe("studio-shell-nav-policy", () => {
  it("resolve: shell + ontbrekend studioNav → ok false", () => {
    const r = resolveStudioNavUnderShellPolicy(shellMaster(), []);
    expect(r?.mode).toBe("shell");
    expect(r && "ok" in r && r.ok).toBe(false);
  });

  it("resolve: shell + geldig studioNav + header in sectie → ok + warning", () => {
    const nav = {
      variant: "bar" as const,
      brandLabel: "B",
      items: [
        { label: "A", href: "#a" },
        { label: "B", href: "#b" },
      ],
    };
    const sections: TailwindSection[] = [
      { sectionName: "hero", html: `<header><nav><a href="#a">A</a></nav></header><main>ok</main>` },
    ];
    const r = resolveStudioNavUnderShellPolicy(shellMaster(nav), sections);
    expect(r?.mode).toBe("shell");
    if (r && "ok" in r && r.ok) {
      expect(r.studioNav.brandLabel).toBe("B");
      expect(r.warnings.length).toBeGreaterThan(0);
    } else {
      expect.fail("expected ok shell resolve");
    }
  });

  it("resolve: geen shell-flag → null", () => {
    const cfg: MasterPromptPageConfig = {
      style: "T",
      theme: { primary: "#000", accent: "#fff" },
      font: "Inter, system-ui, sans-serif",
      studioNav: { variant: "bar", brandLabel: "X", items: [{ label: "A", href: "#a" }] },
    };
    expect(resolveStudioNavUnderShellPolicy(cfg, [])).toBeNull();
  });

  it("validateStudioShellNavConfig", () => {
    expect(validateStudioShellNavConfig(shellMaster())).toMatch(/studioNav/);
    expect(
      validateStudioShellNavConfig(
        shellMaster({ variant: "bar", brandLabel: "Z", items: [{ label: "A", href: "#a" }] }),
      ),
    ).toBeNull();
  });
});
