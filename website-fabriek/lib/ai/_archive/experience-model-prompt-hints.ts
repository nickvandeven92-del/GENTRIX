import type { SiteExperienceModel } from "@/lib/ai/site-experience-model";

/** Korte instructies per model — blijft binnen bestaande layout-archetypes / sectie-id’s. */
export const EXPERIENCE_MODEL_PROMPT_HINTS: Record<SiteExperienceModel, string> = {
  saas_landing:
    "Conversielanding: kernbelofte, vertrouwen (logo’s/cijfers/quotes), aanbod met uitkomsten — visueel als bestemming of merk, géén standaard software-SaaS-template — pricing/tickets als conversiepunt, FAQ voor twijfel.",
  service_leadgen:
    "Lokale / dienst-leadgen: vertrouwen eerst (reviews, certificaten), duidelijke diensten, sterke lokale CTA (bel/plan), FAQ met bezwaren.",
  premium_product:
    "Premium product: weinig ruis, veel witruimte, verhaal + materiaal/kwaliteit, subtiele social proof, koopflow rustig.",
  ecommerce_home:
    "E-commerce homepage: hero ondersteunt ontdekken (zoek/categorie-chips visueel), categorieën of uitgelichte producten, USP-strip, geen blog-achtige muur.",
  search_first_catalog:
    "Catalogus/zoek: zoek of duidelijke discovery boven de fold, filters/chips als visuele hint, grids met hiërarchie (featured vs rest).",
  editorial_content_hub:
    "Content-hub: sterke featured story, topicclusters of tags, artikel-rail met **typografie- en beeldritme** (niet overal zware card-boxes), zoek of topics prominent; geen standaard pricing-tabel tenzij de briefing expliciet verkoopt.",
  health_authority_content:
    "Gezondheid/autoriteit: ingetogen claims, expertiseregel, bronnen/FAQ, geen agressieve sales-taal; vertrouwen boven flashy effecten.",
  hybrid_content_commerce:
    "Content + shop: combineer redactionele blokken met duidelijke product/teaser-rails; twee sporen (lezen / kopen) zichtbaar.",
  brand_storytelling:
    "Merkverhaal: chapters of scroll-verhaal, emotie + craft, zachte CTA’s; minder ‘feature grid’ dan SaaS.",
  community_media:
    "Community: momentum (events, ledental), social proof van leden, content-rail, duidelijke join-CTA.",
};
