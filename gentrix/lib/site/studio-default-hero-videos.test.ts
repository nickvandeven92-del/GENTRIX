import { describe, expect, it } from "vitest";
import { getStudioDefaultHeroVideoPromptBlock } from "@/lib/site/studio-default-hero-videos";

describe("getStudioDefaultHeroVideoPromptBlock", () => {
  it("bevat geen externe video-URL's", () => {
    const block = getStudioDefaultHeroVideoPromptBlock();
    expect(block).not.toMatch(/https?:\/\//i);
    expect(block).not.toMatch(/pexels/i);
  });

  it("legt beleid voor eigen-URL video uit", () => {
    const block = getStudioDefaultHeroVideoPromptBlock();
    expect(block).toMatch(/eigen URL|gebruikersbriefing/i);
    expect(block).toMatch(/<video>/i);
  });
});
