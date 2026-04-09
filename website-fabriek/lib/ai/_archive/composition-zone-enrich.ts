import type {
  AlignmentMode,
  CtaIntensity,
  DensityMode,
  LayoutEnergy,
  MediaPriority,
  PageCompositionArchetype,
  ProofIntensity,
  RichCompositionZone,
  SurfaceMode,
  WidthMode,
  ZonePattern,
  ZoneRole,
} from "@/lib/ai/composition-plan-model";

function inferZoneRole(id: string, narrative: string): ZoneRole {
  const lid = id.toLowerCase();
  const n = narrative.toLowerCase();
  if (/\bfooter\b/.test(lid)) return "footer";
  if (lid === "masthead") return "shell";
  if (
    /^(nav|shell|wayfinding|utility|masthead)$/.test(lid) ||
    (lid.includes("nav") && !lid.includes("hero"))
  ) {
    return "shell";
  }
  if (
    /hero|entry|hook|statement|pulse|dual|cover|trust_hero|search-hero|discovery|masthead/.test(lid) &&
    !lid.startsWith("nav")
  ) {
    if (lid.includes("trust_hero")) return "hero";
    return /discovery|search/.test(lid) ? "discovery" : "hero";
  }
  if (
    /trust|proof|credibility|usp|benefits|review|evidence|member-proof|social|strip|logo|keurmerk/.test(lid) ||
    /vertrouwen|bewijs|reviews|ervaringen/.test(n)
  ) {
    return "trust";
  }
  if (
    /pricing|cta|join|newsletter|conversion|purchase|action|subscribe|afspraak|offerte|aanmelden|soft_cta/.test(
      lid,
    ) ||
    /nieuwsbrief|inschrijven|koop|bestellen/.test(n)
  ) {
    return "conversion";
  }
  if (/shop|commerce|product|category|browse|featured|rail|articles|grid|spotlight/.test(lid)) {
    return "commerce";
  }
  if (/faq|reassure|clarify|pillars|depth|chapters|values|craft|narrative|editorial|story/.test(lid)) {
    if (/faq|reassure|clarify/.test(lid)) return "support";
    return "editorial";
  }
  if (/stream|activity|highlights|read_more|subscribe/.test(lid)) return "commerce";
  return "generic";
}

function patternsForRole(role: ZoneRole, archetype: PageCompositionArchetype): ZonePattern[] {
  const commerceHeavy =
    archetype === "commerce_discovery_stack" ||
    archetype === "catalog_search_spine" ||
    archetype === "hybrid_story_commerce";

  switch (role) {
    case "shell":
      return ["feature_ribbons", "sticky_narrative"];
    case "hero":
    case "discovery":
      return commerceHeavy
        ? ["device_mockup_stage", "card_grid", "asymmetric_columns"]
        : ["editorial_split", "device_mockup_stage", "asymmetric_columns"];
    case "commerce":
      return ["bento_cluster", "card_grid", "media_wall"];
    case "trust":
    case "proof":
      return ["logo_cloud", "floating_proof_strip", "quote_wall"];
    case "conversion":
      return ["cta_block", "comparison_table", "cta_inline"];
    case "editorial":
      return ["sticky_narrative", "editorial_split", "founder_note"];
    case "support":
      return ["faq_stack", "timeline"];
    case "footer":
      return ["feature_ribbons", "stat_band"];
    default:
      return ["asymmetric_columns", "card_grid"];
  }
}

function dnaForRole(
  role: ZoneRole,
  index: number,
  total: number,
  archetype: PageCompositionArchetype,
): {
  widthMode: WidthMode;
  density: DensityMode;
  surfaceMode: SurfaceMode;
  alignmentMode: AlignmentMode;
  mediaPriority: MediaPriority;
  layoutEnergy: LayoutEnergy;
  allowCards: boolean;
  allowAsymmetricBalance: boolean;
  proofIntensity: ProofIntensity;
  ctaIntensity: CtaIntensity;
} {
  const editorial = archetype === "editorial_wave" || archetype === "brand_chapter_scroll";
  const commerce = archetype === "commerce_discovery_stack" || archetype === "catalog_search_spine";

  let widthMode: WidthMode = "wide";
  let density: DensityMode = editorial ? "airy" : "balanced";
  let surfaceMode: SurfaceMode = "open";
  let alignmentMode: AlignmentMode = editorial ? "left_weighted" : "balanced";
  let mediaPriority: MediaPriority = "supporting";
  let layoutEnergy: LayoutEnergy = "structured";
  let allowCards = true;
  let allowAsymmetricBalance = editorial;
  let proofIntensity: ProofIntensity = "none";
  let ctaIntensity: CtaIntensity = "none";

  switch (role) {
    case "shell":
      widthMode = "contained";
      density = "compact";
      surfaceMode = "panel";
      mediaPriority = "none";
      layoutEnergy = "calm";
      allowCards = false;
      break;
    case "hero":
      widthMode = commerce ? "canvas" : "full_bleed";
      density = "airy";
      surfaceMode = editorial ? "editorial" : "immersive";
      alignmentMode = "balanced";
      mediaPriority = "dominant";
      layoutEnergy = commerce ? "dynamic" : "calm";
      allowAsymmetricBalance = true;
      ctaIntensity = "moderate";
      break;
    case "discovery":
      widthMode = "canvas";
      density = "balanced";
      surfaceMode = "open";
      mediaPriority = "equal";
      layoutEnergy = "structured";
      ctaIntensity = "weak";
      break;
    case "commerce":
      widthMode = "wide";
      density = commerce ? "compact" : "balanced";
      surfaceMode = commerce ? "panel" : "alternating";
      alignmentMode = "staggered";
      mediaPriority = "equal";
      layoutEnergy = "dynamic";
      allowCards = true;
      break;
    case "trust":
    case "proof":
      widthMode = "wide";
      density = "balanced";
      surfaceMode = "open";
      proofIntensity = index <= 2 ? "moderate" : "light";
      mediaPriority = "supporting";
      break;
    case "conversion":
      widthMode = index >= total - 2 ? "contained" : "wide";
      density = "balanced";
      surfaceMode = "panel";
      ctaIntensity = "strong";
      alignmentMode = "centered";
      break;
    case "editorial":
      widthMode = editorial ? "canvas" : "wide";
      density = "airy";
      surfaceMode = "editorial";
      alignmentMode = "left_weighted";
      allowAsymmetricBalance = true;
      allowCards = false;
      break;
    case "support":
      widthMode = "contained";
      density = "compact";
      surfaceMode = "panel";
      allowCards = true;
      break;
    case "footer":
      widthMode = "contained";
      density = "compact";
      surfaceMode = "panel";
      mediaPriority = "none";
      layoutEnergy = "calm";
      allowCards = false;
      break;
    default:
      widthMode = index % 2 === 0 ? "wide" : "contained";
      alignmentMode = index % 2 === 0 ? "centered" : "offset";
  }

  return {
    widthMode,
    density,
    surfaceMode,
    alignmentMode,
    mediaPriority,
    layoutEnergy,
    allowCards,
    allowAsymmetricBalance,
    proofIntensity,
    ctaIntensity,
  };
}

/**
 * Zet korte `{ id, role: narratief }` uit de planner om naar rijke zones voor metrics/validatie.
 */
export function enrichBriefZonesToRich(
  zones: Array<{ id: string; role: string }>,
  archetype: PageCompositionArchetype,
): RichCompositionZone[] {
  const total = zones.length;
  return zones.map((z, index) => {
    const narrative = z.role;
    const role = inferZoneRole(z.id, narrative);
    const dna = dnaForRole(role, index, total, archetype);
    const intent =
      role === "trust"
        ? "credibility"
        : role === "commerce"
          ? "browse_or_convert"
          : role === "conversion"
            ? "primary_action"
            : role === "hero" || role === "discovery"
              ? "attention"
              : "support_flow";

    return {
      id: z.id,
      role,
      intent,
      narrative,
      preferredPatterns: patternsForRole(role, archetype),
      ...dna,
    };
  });
}
