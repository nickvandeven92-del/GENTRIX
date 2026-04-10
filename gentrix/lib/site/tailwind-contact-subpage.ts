import { slugifyToSectionId, type TailwindSection } from "@/lib/ai/tailwind-sections-schema";
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
  view: "landing" | "contact";
  contactSectionId: string;
  landingSectionIds: string[];
};

/**
 * Vangt klikken af vóór `STUDIO_SINGLE_PAGE_INTERNAL_NAV_SCRIPT`: stuurt parent/top naar de andere subpagina
 * (sandboxed iframe kan niet betrouwbaar `top.location` zetten).
 */
export function buildContactSubpageCaptureNavScript(input: ContactSubpageNavScriptInput): string {
  const encSlug = encodeURIComponent(input.slug);
  const basePath = `/site/${encSlug}`;
  const contactPath = `${basePath}/contact`;
  const origin = input.pageOrigin.replace(/\/$/, "");
  const baseAbs = `${origin}${basePath}`;
  const contactAbs = `${origin}${contactPath}`;
  const cfg = {
    src: STUDIO_PUBLIC_NAV_MESSAGE_SOURCE,
    view: input.view,
    basePath,
    baseAbs,
    contactPath,
    contactAbs,
    cid: input.contactSectionId,
    lids: input.landingSectionIds,
  };
  const json = JSON.stringify(cfg);
  return `<script>(function(){
var CFG=${json};
function postTop(url){
  try{
    if(window.top&&window.top!==window)window.top.location.assign(url);
    else if(window.parent&&window.parent!==window){
      window.parent.postMessage({source:CFG.src,href:url},window.location.origin||"*");
    }else window.location.assign(url);
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
  if(CFG.view==="landing"){
    if(raw.charAt(0)==="#"){
      var hf=raw.slice(1);
      if(normFrag(hf)===normFrag(CFG.cid)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs);return;}
    }
    try{
      if(/^https?:\\/\\//i.test(raw)){
        var u=new URL(raw);
        var p=u.pathname||"";
        if(p===CFG.contactPath||p===CFG.contactPath+"/"){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs+(u.hash||""));return;}
        if((p===CFG.basePath||p===CFG.basePath+"/")&&u.hash&&u.hash.length>1){
          var hx=normFrag(u.hash.slice(1));
          if(hx===normFrag(CFG.cid)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs);return;}
        }
      }
    }catch(_){}
    try{
      if(raw.charAt(0)==="/"){
        var pq=raw.split("#");
        var pathOnly=pq[0].split("?")[0];
        if(pathOnly===CFG.contactPath||pathOnly===CFG.contactPath+"/"){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs+(pq[1]?"#"+pq[1]:""));return;}
        if((pathOnly===CFG.basePath||pathOnly===CFG.basePath+"/")&&pq[1]&&normFrag(pq[1])===normFrag(CFG.cid)){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.contactAbs);return;}
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
        if((p2===CFG.basePath||p2===CFG.basePath+"/")&&u2.hash&&u2.hash.length>1){
          var f3=normFrag(u2.hash.slice(1));
          if(f3!==normFrag(CFG.cid)&&lidSet[f3]){e.preventDefault();e.stopImmediatePropagation();postTop(CFG.baseAbs+u2.hash);return;}
        }
      }
    }catch(_){}
  }
},true);
})();</script>`;
}
