import { describe, expect, it } from "vitest";
import { buildStudioSinglePageInternalNavScript } from "@/lib/site/tailwind-page-html";

describe("buildStudioSinglePageInternalNavScript", () => {
  it("laat /boek/, /booking-app/ en /winkel/ naar top navigeren i.p.v. preventDefault zonder actie", () => {
    const s = buildStudioSinglePageInternalNavScript(null, "/site/mosham", "https://www.gentrix.nl");
    expect(s).toContain("var STUDIO_TOP_ORIGIN=");
    expect(s).toContain("function isBoekOrWinkelPath");
    expect(s).toContain('if(isBoekOrWinkelPath(pn)){navigateTop(e,a);return;}');
    expect(s).toContain('if(isBoekOrWinkelPath(path)){navigateTop(e,a);return;}');
  });
});
