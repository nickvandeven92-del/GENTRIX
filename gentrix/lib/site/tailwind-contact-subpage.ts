import { slugifyToSectionId, type TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildMarketingSlugSegmentResolutionMap } from "@/lib/site/marketing-path-aliases";
import { STUDIO_PUBLIC_NAV_MESSAGE_SOURCE } from "@/lib/site/studio-public-nav-message";

const FORM_IN_SECTION_RE = /<form\b/i;

/** Zet `SITE_CONTACT_SUBPAGE=1` (server) om /site/[slug]/contact te activeren zonder generator-output te wijzigen. */
export function isSiteContactSubpageSplitEnabled(): boolean {
  const v = process.env.SITE_CONTACT_SUBPAGE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type TailwindContactSubpagePlan = {
  contactSectionIndex: number;
  contactSectionId: string;
};

function isDedicatedContactFormSection(s: TailwindSection, index: number): boolean {
  if (!FORM_IN_SECTION_RE.test(s.html)) return false;
  const id = (s.id ?? slugifyToSectionId(s.sectionName, index)).trim().toLowerCase();
  return id === "contact" || id === "kontakt" || id === "contacteer";
}

/**
 * Detecteert één sectie met formulier + contact-achtige id. Index 0 wordt niet gesplitst (geen zinnige landingspagina).
 */
export function detectTailwindContactSubpagePlan(
  sections: TailwindSection[],
): TailwindContactSubpagePlan | null {
  if (!isSiteContactSubpageSplitEnabled()) return null;
  const idx = sections.findIndex((s, i) => isDedicatedContactFormSection(s, i));
  if (idx <= 0) return null;
  const sec = sections[idx];
  const contactSectionId = sec.id ?? slugifyToSectionId(sec.sectionName, idx);
  return { contactSectionIndex: idx, contactSectionId };
}

export function selectTailwindSectionsForContactSubpageView(
  sections: TailwindSection[],
  view: "landing" | "contact",
  plan: TailwindContactSubpagePlan,
): TailwindSection[] {
  const { contactSectionIndex } = plan;
  if (view === "landing") {
    return sections.filter((_, i) => i !== contactSectionIndex);
  }
  return [sections[0], ...sections.slice(contactSectionIndex)];
}

export function landingSectionIdsForContactSubpage(
  sections: TailwindSection[],
  plan: TailwindContactSubpagePlan,
): string[] {
  const subset = selectTailwindSectionsForContactSubpageView(sections, "landing", plan);
  return subset.map((s) => {
    const origIdx = sections.indexOf(s);
    const idx = origIdx >= 0 ? origIdx : 0;
    return s.id ?? slugifyToSectionId(s.sectionName, idx);
  });
}

export type ContactSubpageNavScriptInput = {
  pageOrigin: string;
  slug: string;
  view: "landing" | "contact" | "marketing";
  contactSectionId: string;
  landingSectionIds: string[];
  /**
   * Keys uit `marketingPages` in `site_data_json` — cross-nav tussen `/site/{slug}/…` subroutes.
   */
  marketingSlugs?: string[];
  /** Gezet wanneer `view === "marketing"` (huidige subpagina in iframe). */
  activeMarketingSlug?: string;
  /**
   * Concept met token: top-navigatie gebruikt `/site/...?token=` (zelfde als live).
   * Oude `/preview/...`-paden in HTML worden nog herkend via `legB`/`legC`.
   */
  draftPublicPreviewToken?: string | null;
  /** Flyer/QR: `flyer=1` op alle `postTop`-URL’s (actiebalk blijft op subpagina’s). */
  flyerPreview?: boolean;
  /**
   * Primaire studio-host of klant-domein: sla `/site/{slug}` over en emit `/`, `/contact`, `/werkwijze`, …
   * De middleware routet deze korte paden intern terug naar `/site/{slug}/…`.
   */
  prettyPublicUrls?: boolean;
  /**
   * Standaard `STUDIO_PUBLIC_NAV_MESSAGE_SOURCE` (publieke /site-embed). In de HTML-editor: zelfde als
   * `STUDIO_HTML_EDITOR_IFRAME_NAV_SOURCE` zodat de parent de preview schakelt i.p.v. te navigeren.
   */
  iframeNavMessageSource?: string;
};

/**
 * Vangt klikken af vóór `buildStudioSinglePageInternalNavScript`: stuurt parent/top naar de andere subpagina
 * (sandboxed iframe kan niet betrouwbaar `top.location` zetten).
 */
export function buildContactSubpageCaptureNavScript(input: ContactSubpageNavScriptInput): string {
  const encSlug = encodeURIComponent(input.slug);
  const tokenRaw = typeof input.draftPublicPreviewToken === "string" ? input.draftPublicPreviewToken.trim() : "";
  const flyer = Boolean(input.flyerPreview);
  const tokenQ =
    tokenRaw.length > 0 || flyer
      ? `?${[
          ...(tokenRaw.length > 0 ? [`token=${encodeURIComponent(tokenRaw)}`] : []),
          ...(flyer ? ["flyer=1"] : []),
        ].join("&")}`
      : "";
  const basePath = `/site/${encSlug}`;
  const contactPath = `${basePath}/contact`;
  const prevBase = tokenRaw.length > 0 ? `/preview/${encSlug}` : null;
  const legB = prevBase;
  const legC = prevBase ? `${prevBase}/contact` : null;
  const origin = input.pageOrigin.replace(/\/$/, "");
  const pretty = input.prettyPublicUrls === true && tokenRaw.length === 0;
  // Pretty URLs: user-facing href = `/`, `/contact`, `/werkwijze`. Interne route verzorgt de middleware.
  const baseAbs = pretty ? `${origin}/` : `${origin}${basePath}${tokenQ}`;
  const contactAbs = pretty ? `${origin}/contact` : `${origin}${contactPath}${tokenQ}`;
  const marketingSlugs = (input.marketingSlugs ?? []).filter((s) => typeof s === "string" && s.trim().length > 0);
  const mseg = buildMarketingSlugSegmentResolutionMap(marketingSlugs);
  const mabs: Record<string, string> = {};
  for (const k of marketingSlugs) {
    mabs[k] = pretty
      ? `${origin}/${encodeURIComponent(k)}`
      : `${origin}${basePath}/${encodeURIComponent(k)}${tokenQ}`;
  }
  const navMsgSrc = input.iframeNavMessageSource?.trim() || STUDIO_PUBLIC_NAV_MESSAGE_SOURCE;
  const cfg = {
    origin,
    src: navMsgSrc,
    view: input.view,
    basePath,
    prevBase,
    baseAbs,
    contactPath,
    contactAbs,
    legB,
    legC,
    cid: input.contactSectionId,
    lids: input.landingSectionIds,
    ms: marketingSlugs,
    mabs,
    mseg,
    mcur: input.view === "marketing" ? (input.activeMarketingSlug ?? "").trim() : "",
    /** Pretty URL host: `/` en `/contact` tellen als base resp. contact — náást de interne `/site/{slug}`-paden. */
    pretty: pretty ? 1 : 0,
  };
  const json = JSON.stringify(cfg);
  return `<script>(function(){
var CFG=${json};
function isBase(p){
  if(p===CFG.basePath||p===CFG.basePath+"/")return true;
  if(CFG.legB&&(p===CFG.legB||p===CFG.legB+"/"))return true;
  if(CFG.pretty&&(p===""||p==="/"))return true;
  return false;
}
function isContact(p){
  if(p===CFG.contactPath||p===CFG.contactPath+"/")return true;
  if(CFG.legC&&(p===CFG.legC||p===CFG.legC+"/"))return true;
  if(CFG.pretty&&(p==="/contact"||p==="/contact/"))return true;
  return false;
}
function marketingSegKey(basePath,p){
  if(p.indexOf(basePath+"/")!==0)return "";
  var tail=p.slice(basePath.length+1);
  var seg0=(tail.split("/")[0]||"").split("?")[0];
  if(!seg0)return "";
  try{seg0=decodeURIComponent(seg0);}catch(_){}
  return seg0.toLowerCase();
}
function isMarketingPath(p){
  if(!CFG.ms||!CFG.ms.length)return null;
  for(var i=0;i<CFG.ms.length;i++){
    var k=CFG.ms[i];
    var mp=CFG.basePath+"/"+k;
    if(p===mp||p===mp+"/")return k;
    if(CFG.prevBase){
      var mp2=CFG.prevBase+"/"+k;
      if(p===mp2||p===mp2+"/")return k;
    }
  }
  var sk=marketingSegKey(CFG.basePath,p);
  if(sk&&CFG.mseg&&CFG.mseg[sk])return CFG.mseg[sk];
  if(CFG.legB){
    var sk2=marketingSegKey(CFG.legB,p);
    if(sk2&&CFG.mseg&&CFG.mseg[sk2])return CFG.mseg[sk2];
  }
  if(sk){
    for(var j=0;j<CFG.ms.length;j++){
      if((CFG.ms[j]||"").toLowerCase()===sk)return CFG.ms[j];
    }
  }
  var rp=(p||"").split("?")[0];
  if(rp.charAt(0)==="/"){
    var rootOnly=rp.split("/").filter(Boolean);
    if(rootOnly.length===1){
      var rseg=rootOnly[0]||"";
      try{rseg=decodeURIComponent(rseg);}catch(_){}
      var rlow=rseg.toLowerCase();
      if(CFG.mseg&&CFG.mseg[rlow])return CFG.mseg[rlow];
      for(var t=0;t<CFG.ms.length;t++){
        if((CFG.ms[t]||"").toLowerCase()===rlow)return CFG.ms[t];
      }
    }
  }
  return null;
}
function postTop(url){
  try{
    if(window.parent&&window.parent!==window){
      var pmOrigin=CFG.origin&&CFG.origin.length?CFG.origin:"*";
      window.parent.postMessage({source:CFG.src,href:url},pmOrigin);
      return;
    }
    if(window.top&&window.top!==window){
      window.top.location.assign(url);
      return;
    }
    window.location.assign(url);
  }catch(_){
    try{window.parent.postMessage({source:CFG.src,href:url},"*");}catch(__){}
  }
}
function normFrag(f){
  try{return decodeURIComponent(f);}catch(_){return f;}
}
document.addEventListener("click",function(e){
  var t=e.target;
  if(!t||!t.closest)return;
  var a=t.closest("a[href]");
  if(!a)return;
  if(a.getAttribute("target")==="_blank")return;
  var raw=(a.getAttribute("href")||"").trim();
  if(!raw||/^(mailto:|tel:|javascript:)/i.test(raw))return;
  if(CFG.view==="marketing"){
    var lidM={};
    for(var im=0;im<CFG.lids.length;im++)lidM[normFrag(CFG.lids[im])]=true;
    if(raw.charAt(0)==="#"){
      var fm=normFrag(raw.slice(1));
      if(lidM[fm]){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.baseAbs+raw);return;}
      return;
    }
    try{
      var absM=raw.charAt(0)==="/"?CFG.origin+raw:raw;
      var um=new URL(absM);
      var pm=um.pathname||"";
      if(isContact(pm)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs+(um.hash||""));return;}
      if(isBase(pm)&&(!um.hash||um.hash.length<=1)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.baseAbs);return;}
      if(isBase(pm)&&um.hash&&um.hash.length>1&&lidM[normFrag(um.hash.slice(1))]){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.baseAbs+um.hash);return;}
      var mk=isMarketingPath(pm);
      if(mk&&normFrag(mk)!==normFrag(CFG.mcur)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.mabs[mk]+(um.hash||""));return;}
    }catch(_){}
    return;
  }
  if(CFG.view==="landing"){
    if(raw.charAt(0)==="#"){
      var hf=raw.slice(1);
      if(normFrag(hf)===normFrag(CFG.cid)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs);return;}
    }
    try{
      if(/^https?:\\/\\//i.test(raw)){
        var u=new URL(raw);
        var p=u.pathname||"";
        if(isContact(p)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs+(u.hash||""));return;}
        var mkU=isMarketingPath(p);
        if(mkU){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.mabs[mkU]+(u.hash||""));return;}
        if(isBase(p)&&u.hash&&u.hash.length>1){
          var hx=normFrag(u.hash.slice(1));
          if(hx===normFrag(CFG.cid)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs);return;}
        }
      }
    }catch(_){}
    try{
      if(raw.charAt(0)==="/"){
        var pq=raw.split("#");
        var pathOnly=pq[0].split("?")[0];
        if(isContact(pathOnly)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs+(pq[1]?"#"+pq[1]:""));return;}
        var mkR=isMarketingPath(pathOnly);
        if(mkR){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.mabs[mkR]+(pq[1]?"#"+pq[1]:""));return;}
        if(isBase(pathOnly)&&pq[1]&&normFrag(pq[1])===normFrag(CFG.cid)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs);return;}
      }
    }catch(__){}
    return;
  }
  if(CFG.view==="contact"){
    var lidSet={};
    for(var i=0;i<CFG.lids.length;i++)lidSet[normFrag(CFG.lids[i])]=true;
    if(raw.charAt(0)==="#"){
      var f2=normFrag(raw.slice(1));
      if(f2===normFrag(CFG.cid))return;
      if(lidSet[f2]){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.baseAbs+raw);return;}
    }
    try{
      if(/^https?:\\/\\//i.test(raw)){
        var u2=new URL(raw);
        var p2=u2.pathname||"";
        if(isBase(p2)&&u2.hash&&u2.hash.length>1){
          var f3=normFrag(u2.hash.slice(1));
          if(f3!==normFrag(CFG.cid)&&lidSet[f3]){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.baseAbs+u2.hash);return;}
        }
        var mk2=isMarketingPath(p2);
        if(mk2){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.mabs[mk2]+(u2.hash||""));return;}
      }
    }catch(_){}
    try{
      if(raw.charAt(0)==="/"){
        var pqC=raw.split("#");
        var pathC=pqC[0].split("?")[0];
        if(isBase(pathC)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.baseAbs+(pqC[1]?"#"+pqC[1]:""));return;}
        var mkC=isMarketingPath(pathC);
        if(mkC){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.mabs[mkC]+(pqC[1]?"#"+pqC[1]:""));return;}
      }
    }catch(__){}
  }
},true);
})();</script>`;
}

/** Publieke weergave: geen split | env-split uit één JSON | aparte `contactSections` (generator). */
export type PublicTailwindContactPlan =
  | { kind: "none" }
  | { kind: "dedicated"; firstContactSectionId: string; contactSections: TailwindSection[] }
  | ({ kind: "split" } & TailwindContactSubpagePlan);

export function resolvePublicTailwindContactPlan(
  landingSections: TailwindSection[],
  dedicatedContactSections?: TailwindSection[] | null | undefined,
): PublicTailwindContactPlan {
  if (dedicatedContactSections != null && dedicatedContactSections.length > 0) {
    const s0 = dedicatedContactSections[0]!;
    const firstContactSectionId = (s0.id?.trim() || slugifyToSectionId(s0.sectionName, 0)).trim();
    return { kind: "dedicated", firstContactSectionId, contactSections: dedicatedContactSections };
  }
  const split = detectTailwindContactSubpagePlan(landingSections);
  if (!split) return { kind: "none" };
  return { kind: "split", ...split };
}

export function hasResolvedPublicContactRoute(plan: PublicTailwindContactPlan): boolean {
  return plan.kind !== "none";
}

export function selectTailwindSectionsForPublicView(
  landingSections: TailwindSection[],
  view: "landing" | "contact",
  plan: PublicTailwindContactPlan,
): TailwindSection[] {
  if (plan.kind === "none") return landingSections;
  if (plan.kind === "dedicated") {
    return view === "contact" ? plan.contactSections : landingSections;
  }
  return selectTailwindSectionsForContactSubpageView(landingSections, view, plan);
}

export function landingSectionIdsForPublicSubpageNav(
  landingSections: TailwindSection[],
  plan: PublicTailwindContactPlan,
): string[] {
  if (plan.kind === "none" || plan.kind === "dedicated") {
    return landingSections.map((s, i) => s.id ?? slugifyToSectionId(s.sectionName, i));
  }
  return landingSectionIdsForContactSubpage(landingSections, plan);
}

export function contactNavCaptureFragmentId(plan: PublicTailwindContactPlan): string {
  if (plan.kind === "none") return "contact";
  if (plan.kind === "dedicated") return plan.firstContactSectionId;
  return plan.contactSectionId;
}

/**
 * Canonical pathname van de huidige Tailwind-pagina in de browser (`/site/{slug}`, subroute, contact).
 * Gebruikt door de iframe-nav: een link naar de landings-URL moet de parent laten navigeren, niet alleen scrollen in `srcDoc`.
 */
export function publicSiteIframeDocumentPathname(
  publishedSlug: string | undefined | null,
  nav:
    | {
        view: "landing" | "contact" | "marketing";
        activeMarketingSlug?: string;
      }
    | null
    | undefined,
): string | undefined {
  const raw = publishedSlug?.trim();
  if (!raw) return undefined;
  const enc = encodeURIComponent(raw);
  const root = `/site/${enc}`;
  if (!nav) return root;
  if (nav.view === "contact") return `${root}/contact`;
  if (nav.view === "marketing") {
    const mk = nav.activeMarketingSlug?.trim();
    if (mk) return `${root}/${encodeURIComponent(mk)}`;
  }
  return root;
}
