import { describe, expect, it } from "vitest";
import {
  addResponsiveSrcsetToHeroSupabaseRenderImages,
  buildSupabaseRenderSrcsetFromRenderUrl,
  inferHeroImgSizesFromAttrs,
  promoteHeroSupabaseBackgroundUrlToImg,
  qualityForSrcsetWidth,
  rewriteSupabaseStorageObjectUrlsForWebDelivery,
  supabaseStorageObjectUrlToRenderUrl,
} from "@/lib/site/supabase-storage-delivery-url";

describe("supabaseStorageObjectUrlToRenderUrl", () => {
  it("zet object/public om naar render/image met width/quality", () => {
    const inUrl =
      "https://abcdefgh.supabase.co/storage/v1/object/public/site-assets/foo/hero.jpg";
    const out = supabaseStorageObjectUrlToRenderUrl(inUrl);
    expect(out).toContain("/storage/v1/render/image/public/site-assets/foo/hero.jpg");
    expect(out).toMatch(/width=2400/);
    expect(out).toMatch(/quality=82/);
    expect(out).toMatch(/resize=cover/);
  });

  it("laat al-getransformeerde URL ongemoeid", () => {
    const u =
      "https://abcdefgh.supabase.co/storage/v1/render/image/public/site-assets/x.png?width=100";
    expect(supabaseStorageObjectUrlToRenderUrl(u)).toBe(u);
  });

  it("laat favicon-paden ongemoeid", () => {
    const u =
      "https://abcdefgh.supabase.co/storage/v1/object/public/site-assets/favicon-abc.png";
    expect(supabaseStorageObjectUrlToRenderUrl(u)).toBe(u);
  });
});

describe("rewriteSupabaseStorageObjectUrlsForWebDelivery", () => {
  it("herschrift url() in Tailwind arbitrary en src", () => {
    const html = `<section class="bg-[url('https://xx.supabase.co/storage/v1/object/public/site-assets/bg.webp')]">
<img src="https://xx.supabase.co/storage/v1/object/public/site-assets/h.jpg" alt=""/></section>`;
    const out = rewriteSupabaseStorageObjectUrlsForWebDelivery(html);
    expect(out).not.toContain("/object/public/");
    expect(out).toContain("/render/image/public/");
    expect(out.match(/render\/image\/public/g)?.length).toBe(2);
  });
});

describe("qualityForSrcsetWidth", () => {
  it("verhoogt quality op grotere srcset-breedtes", () => {
    expect(qualityForSrcsetWidth(640, 82)).toBe(78);
    expect(qualityForSrcsetWidth(2400, 82)).toBe(84);
  });
});

describe("inferHeroImgSizesFromAttrs", () => {
  it("gebruikt 100vw zonder herkenbare layout", () => {
    expect(inferHeroImgSizesFromAttrs(`class="w-full object-cover"`)).toBe("100vw");
  });

  it("pakt max-w-2xl", () => {
    expect(inferHeroImgSizesFromAttrs(`class="w-full max-w-2xl mx-auto"`)).toBe(
      "(max-width: 768px) 100vw, 672px",
    );
  });

  it("pakt md:w-1/2", () => {
    expect(inferHeroImgSizesFromAttrs(`class="w-full md:w-1/2 object-cover"`)).toBe(
      "(max-width: 768px) 100vw, 50vw",
    );
  });
});

describe("buildSupabaseRenderSrcsetFromRenderUrl", () => {
  it("bouwt srcset met variërende quality", () => {
    const src =
      "https://ab.supabase.co/storage/v1/render/image/public/site-assets/p/hero.jpg?width=2400&quality=82&resize=cover";
    const srcset = buildSupabaseRenderSrcsetFromRenderUrl(src);
    expect(srcset).toBeTruthy();
    expect(srcset!.split(",").length).toBe(5);
    expect(srcset).toMatch(/640w/);
    expect(srcset).toMatch(/2400w/);
    expect(srcset).toMatch(/quality=78/);
    expect(srcset).toMatch(/quality=84/);
  });

  it("kan vaste quality houden", () => {
    const src =
      "https://ab.supabase.co/storage/v1/render/image/public/site-assets/p/hero.jpg?width=100&quality=80&resize=cover";
    const srcset = buildSupabaseRenderSrcsetFromRenderUrl(src, { variableQuality: false, quality: 80 });
    expect(srcset!.match(/quality=80/g)?.length).toBe(5);
  });

  it("geeft null voor geen render-URL", () => {
    expect(buildSupabaseRenderSrcsetFromRenderUrl("https://example.com/a.jpg")).toBeNull();
  });
});

describe("promoteHeroSupabaseBackgroundUrlToImg", () => {
  it("promoot bg-[url(supabase)] naar img en verwijdert bg-token", () => {
    const html = `<section id="hero" class="relative min-h-screen bg-[url('https://ab.supabase.co/storage/v1/render/image/public/site-assets/x/hero.jpg?width=2400&amp;quality=82&amp;resize=cover')] bg-cover"><div class="z-10">Hi</div></section>`;
    const out = promoteHeroSupabaseBackgroundUrlToImg(html);
    expect(out).toContain("<img ");
    expect(out).toContain('src="https://ab.supabase.co/storage/v1/render/image/public/site-assets/x/hero.jpg?width=2400&amp;quality=82&amp;resize=cover"');
    expect(out).not.toContain("bg-[url(");
  });

  it("doet niets als er al een object-cover supabase-img is", () => {
    const html = `<section class="relative"><img class="object-cover" src="https://ab.supabase.co/storage/v1/render/image/public/site-assets/a.jpg?width=100" alt=""/><div class="bg-[url('https://ab.supabase.co/storage/v1/render/image/public/site-assets/b.jpg')]"></div></section>`;
    expect(promoteHeroSupabaseBackgroundUrlToImg(html)).toBe(html);
  });
});

describe("addResponsiveSrcsetToHeroSupabaseRenderImages", () => {
  it("voegt srcset en sizes toe op render-src", () => {
    const src =
      "https://ab.supabase.co/storage/v1/render/image/public/site-assets/p/hero.jpg?width=2400&quality=82&resize=cover";
    const html = `<section><img class="w-full object-cover" src="${src}" alt="H"/></section>`;
    const out = addResponsiveSrcsetToHeroSupabaseRenderImages(html);
    expect(out).toMatch(/srcset="/);
    expect(out).toMatch(/sizes="100vw"/);
    expect(out).toMatch(/640w/);
  });

  it("zet sizes op split-kolom img", () => {
    const src =
      "https://ab.supabase.co/storage/v1/render/image/public/site-assets/p/hero.jpg?width=2400&quality=82&resize=cover";
    const html = `<img class="w-full md:w-1/2 object-cover" src="${src}" alt="">`;
    const out = addResponsiveSrcsetToHeroSupabaseRenderImages(html);
    expect(out).toMatch(/sizes="\(max-width: 768px\) 100vw, 50vw"/);
  });

  it("laat bestaande srcset met rust", () => {
    const html = `<img src="https://ab.supabase.co/storage/v1/render/image/public/b/x.jpg?width=100" srcset="x 1x" alt="">`;
    expect(addResponsiveSrcsetToHeroSupabaseRenderImages(html)).toBe(html);
  });
});
