// —— Page archetypes (macro-compositie) ——
export const PAGE_COMPOSITION_ARCHETYPE_VALUES = [
  "commerce_discovery_stack",
  "catalog_search_spine",
  "editorial_wave",
  "saas_proof_ladder",
  "service_trust_cta",
  "premium_breath",
  "health_authority_stack",
  "hybrid_story_commerce",
  "brand_chapter_scroll",
  "community_momentum",
  "default_professional",
] as const;

export type PageCompositionArchetype = (typeof PAGE_COMPOSITION_ARCHETYPE_VALUES)[number];

// —— Pattern families ——
export type PatternFamily =
  | "split"
  | "grid"
  | "band"
  | "stack"
  | "stage"
  | "editorial"
  | "conversion"
  | "proof";

export type ZonePattern =
  | "editorial_split"
  | "asymmetric_columns"
  | "bento_cluster"
  | "floating_proof_strip"
  | "stat_band"
  | "logo_cloud"
  | "quote_wall"
  | "product_frame"
  | "device_mockup_stage"
  | "comparison_table"
  | "faq_stack"
  | "sticky_narrative"
  | "card_grid"
  | "media_wall"
  | "timeline"
  | "cta_block"
  | "cta_inline"
  | "founder_note"
  | "feature_ribbons"
  | "proof_marquee";

export const PATTERN_FAMILY: Record<ZonePattern, PatternFamily> = {
  editorial_split: "editorial",
  asymmetric_columns: "split",
  bento_cluster: "grid",
  floating_proof_strip: "proof",
  stat_band: "band",
  logo_cloud: "proof",
  quote_wall: "proof",
  product_frame: "stage",
  device_mockup_stage: "stage",
  comparison_table: "conversion",
  faq_stack: "stack",
  sticky_narrative: "editorial",
  card_grid: "grid",
  media_wall: "grid",
  timeline: "stack",
  cta_block: "conversion",
  cta_inline: "conversion",
  founder_note: "editorial",
  feature_ribbons: "band",
  proof_marquee: "proof",
};

// —— Zone DNA ——
export type WidthMode = "full_bleed" | "canvas" | "wide" | "contained" | "narrow";
export type DensityMode = "airy" | "balanced" | "compact" | "compressed";
export type SurfaceMode = "open" | "editorial" | "alternating" | "panel" | "immersive";
export type AlignmentMode = "centered" | "balanced" | "left_weighted" | "offset" | "staggered";
export type MediaPriority = "none" | "supporting" | "equal" | "dominant";
export type LayoutEnergy = "calm" | "structured" | "dynamic" | "volatile";

export type ZoneRole =
  | "hero"
  | "shell"
  | "discovery"
  | "commerce"
  | "trust"
  | "proof"
  | "conversion"
  | "editorial"
  | "footer"
  | "support"
  | "generic";

export type ProofIntensity = "none" | "light" | "moderate" | "heavy";
export type CtaIntensity = "none" | "weak" | "moderate" | "strong";

/** Rijke zone voor metrics, contrast en repair — `narrative` blijft de menselijke briefingtekst. */
export type RichCompositionZone = {
  id: string;
  role: ZoneRole;
  /** Korte intent (credibility, browse, …) */
  intent: string;
  narrative: string;
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
  preferredPatterns: ZonePattern[];
};

export type LayoutDNA = {
  grid: "12col" | "16col";
  gutter: "breathing" | "generous" | "tight";
  verticalRhythm: "fluid" | "modular" | "event_driven";
  spacingUnit: number;
};

export type CompositionIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  suggestedFix?: string;
  affectedZoneIds?: string[];
};

export type CompositionQualityReport = {
  score: number;
  strengths: string[];
  warnings: CompositionIssue[];
  fixes: string[];
};

/**
 * Macro-compositie vóór sectiedetail; zones zijn rijk genoeg voor contrast-metrics en validators.
 */
export type CompositionPlan = {
  macroComposition: string;
  layoutArchetype: PageCompositionArchetype;
  visualTension: string;
  motionPersonality: string;
  compositionZones: RichCompositionZone[];
  layoutDNA?: LayoutDNA;
  qualityReport?: CompositionQualityReport;
};

export interface ZoneContrastVector {
  widthShift: number;
  densityShift: number;
  surfaceShift: number;
  alignmentShift: number;
  mediaShift: number;
  energyShift: number;
  total: number;
}

const WIDTH_WEIGHT: Record<WidthMode, number> = {
  full_bleed: 4,
  canvas: 3,
  wide: 2,
  contained: 1,
  narrow: 0,
};

const DENSITY_WEIGHT: Record<DensityMode, number> = {
  airy: 0,
  balanced: 1,
  compact: 2,
  compressed: 3,
};

const SURFACE_WEIGHT: Record<SurfaceMode, number> = {
  open: 0,
  editorial: 1,
  alternating: 2,
  panel: 3,
  immersive: 4,
};

const ALIGNMENT_WEIGHT: Record<AlignmentMode, number> = {
  centered: 0,
  balanced: 1,
  left_weighted: 2,
  offset: 3,
  staggered: 4,
};

const MEDIA_WEIGHT: Record<MediaPriority, number> = {
  none: 0,
  supporting: 1,
  equal: 2,
  dominant: 3,
};

const ENERGY_WEIGHT: Record<LayoutEnergy, number> = {
  calm: 0,
  structured: 1,
  dynamic: 2,
  volatile: 3,
};

export function getZoneContrast(a: RichCompositionZone, b: RichCompositionZone): ZoneContrastVector {
  const widthShift = Math.abs(WIDTH_WEIGHT[a.widthMode] - WIDTH_WEIGHT[b.widthMode]);
  const densityShift = Math.abs(DENSITY_WEIGHT[a.density] - DENSITY_WEIGHT[b.density]);
  const surfaceShift = Math.abs(SURFACE_WEIGHT[a.surfaceMode] - SURFACE_WEIGHT[b.surfaceMode]);
  const alignmentShift = Math.abs(ALIGNMENT_WEIGHT[a.alignmentMode] - ALIGNMENT_WEIGHT[b.alignmentMode]);
  const mediaShift = Math.abs(MEDIA_WEIGHT[a.mediaPriority] - MEDIA_WEIGHT[b.mediaPriority]);
  const energyShift = Math.abs(ENERGY_WEIGHT[a.layoutEnergy] - ENERGY_WEIGHT[b.layoutEnergy]);

  return {
    widthShift,
    densityShift,
    surfaceShift,
    alignmentShift,
    mediaShift,
    energyShift,
    total:
      widthShift + densityShift + surfaceShift + alignmentShift + mediaShift + energyShift,
  };
}

export interface CompositionPlanMetrics {
  cardZoneCount: number;
  containedZoneStreak: number;
  panelZoneStreak: number;
  centeredZoneStreak: number;
  repeatedPatternFamilyPairs: number;
  openCanvasMoments: number;
  asymmetricZoneCount: number;
  earlyProofIndex: number | null;
  strongCTAIndex: number | null;
  averageContrast: number;
}

export function getCompositionPlanMetrics(plan: CompositionPlan): CompositionPlanMetrics {
  const zones = plan.compositionZones;

  let cardZoneCount = 0;
  let repeatedPatternFamilyPairs = 0;
  let openCanvasMoments = 0;
  let asymmetricZoneCount = 0;
  let earlyProofIndex: number | null = null;
  let strongCTAIndex: number | null = null;

  let maxContainedStreak = 0;
  let maxPanelStreak = 0;
  let maxCenteredStreak = 0;

  let currentContainedStreak = 0;
  let currentPanelStreak = 0;
  let currentCenteredStreak = 0;

  const contrastTotals: number[] = [];

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];

    if (zone.allowCards) cardZoneCount++;
    if (zone.widthMode === "full_bleed" || zone.widthMode === "canvas") openCanvasMoments++;
    if (zone.allowAsymmetricBalance) asymmetricZoneCount++;

    if (
      zone.role === "trust" ||
      zone.role === "proof" ||
      zone.proofIntensity === "heavy" ||
      zone.proofIntensity === "moderate"
    ) {
      if (earlyProofIndex === null) earlyProofIndex = i;
    }

    if (zone.ctaIntensity === "strong") {
      if (strongCTAIndex === null) strongCTAIndex = i;
    }

    currentContainedStreak =
      zone.widthMode === "contained" || zone.widthMode === "narrow" ? currentContainedStreak + 1 : 0;
    maxContainedStreak = Math.max(maxContainedStreak, currentContainedStreak);

    currentPanelStreak = zone.surfaceMode === "panel" ? currentPanelStreak + 1 : 0;
    maxPanelStreak = Math.max(maxPanelStreak, currentPanelStreak);

    currentCenteredStreak = zone.alignmentMode === "centered" ? currentCenteredStreak + 1 : 0;
    maxCenteredStreak = Math.max(maxCenteredStreak, currentCenteredStreak);

    if (i > 0) {
      const prev = zones[i - 1]!;
      const prevPat = prev.preferredPatterns[0];
      const curPat = zone.preferredPatterns[0];
      const prevFamily = prevPat ? PATTERN_FAMILY[prevPat] : null;
      const currentFamily = curPat ? PATTERN_FAMILY[curPat] : null;

      if (prevFamily && currentFamily && prevFamily === currentFamily) {
        repeatedPatternFamilyPairs++;
      }

      contrastTotals.push(getZoneContrast(prev, zone).total);
    }
  }

  const averageContrast =
    contrastTotals.length > 0 ? contrastTotals.reduce((a, b) => a + b, 0) / contrastTotals.length : 0;

  return {
    cardZoneCount,
    containedZoneStreak: maxContainedStreak,
    panelZoneStreak: maxPanelStreak,
    centeredZoneStreak: maxCenteredStreak,
    repeatedPatternFamilyPairs,
    openCanvasMoments,
    asymmetricZoneCount,
    earlyProofIndex,
    strongCTAIndex,
    averageContrast,
  };
}

function validatePatternConstraints(zone: RichCompositionZone): CompositionIssue[] {
  const out: CompositionIssue[] = [];
  for (const p of zone.preferredPatterns) {
    if (!(p in PATTERN_FAMILY)) {
      out.push({
        code: "unknown_zone_pattern",
        severity: "warning",
        message: `Onbekend preferred pattern "${p}" in zone ${zone.id}.`,
        affectedZoneIds: [zone.id],
        suggestedFix: "Gebruik een bekende ZonePattern uit PATTERN_FAMILY.",
      });
    }
  }
  if (zone.preferredPatterns.length === 0) {
    out.push({
      code: "no_preferred_pattern",
      severity: "warning",
      message: `Zone "${zone.id}" heeft geen preferredPatterns.`,
      affectedZoneIds: [zone.id],
      suggestedFix: "Voeg minstens één ZonePattern toe voor richting naar HTML-compositie.",
    });
  }
  return out;
}

function zoneIsPrimaryHeroSpatial(zone: RichCompositionZone, index: number): boolean {
  if (zone.role === "hero") return true;
  if (index !== 0) return false;
  return /^(hero|entry|hook|statement|pulse|dual|trust_hero|cover|masthead|search)/i.test(zone.id);
}

export function validateCompositionPlan(plan: CompositionPlan): CompositionQualityReport {
  const warnings: CompositionIssue[] = [];
  const strengths: string[] = [];
  const fixes: string[] = [];

  const metrics = getCompositionPlanMetrics(plan);
  const zones = plan.compositionZones;

  for (const zone of zones) {
    warnings.push(...validatePatternConstraints(zone));
  }

  if (metrics.openCanvasMoments < 1) {
    warnings.push({
      code: "no_open_canvas_moment",
      severity: "warning",
      message: "Plan mist een open/canvas moment met visuele ademruimte.",
      suggestedFix: "Maak minstens één vroege zone full_bleed of canvas.",
    });
    fixes.push("Voeg één duidelijke open-canvas zone toe.");
  } else {
    strengths.push("Bevat minstens één open compositiemoment.");
  }

  if (metrics.containedZoneStreak >= 3) {
    warnings.push({
      code: "too_many_contained_zones",
      severity: "warning",
      message: `Er staan ${metrics.containedZoneStreak} contained/narrow zones achter elkaar.`,
      suggestedFix: "Breek dit met wide of full_bleed.",
    });
    fixes.push("Doorbreek contained streak met wide/full-bleed zone.");
  }

  if (metrics.panelZoneStreak >= 3) {
    warnings.push({
      code: "too_many_panels_in_a_row",
      severity: "warning",
      message: `Er staan ${metrics.panelZoneStreak} panel-zones achter elkaar.`,
      suggestedFix: "Vervang minstens één panel-zone door open/editorial surface.",
    });
    fixes.push("Verminder panel-op-panel-op-panel.");
  }

  if (metrics.centeredZoneStreak >= 3) {
    warnings.push({
      code: "flat_centered_rhythm",
      severity: "warning",
      message: `Er staan ${metrics.centeredZoneStreak} centered zones achter elkaar.`,
      suggestedFix: "Gebruik left_weighted, offset of staggered.",
    });
    fixes.push("Breek gecentreerde herhaling met asymmetrische alignment.");
  }

  if (metrics.repeatedPatternFamilyPairs >= 2) {
    warnings.push({
      code: "repeated_layout_pattern",
      severity: "warning",
      message: "Te veel opeenvolgende zones uit dezelfde pattern family.",
      suggestedFix: "Wissel split/grid/band/editorial sterker af.",
    });
    fixes.push("Verhoog family-variatie tussen zones.");
  }

  if (metrics.earlyProofIndex === null || metrics.earlyProofIndex > 2) {
    warnings.push({
      code: "proof_too_late",
      severity: "warning",
      message: "Proof komt te laat in de pagina.",
      suggestedFix: "Plaats trust/proof uiterlijk in zone 2 of 3 (index ≤ 2).",
    });
    fixes.push("Breng bewijs eerder naar voren.");
  }

  if (metrics.strongCTAIndex === null) {
    warnings.push({
      code: "cta_too_weak",
      severity: "warning",
      message: "Geen sterke CTA-zone gevonden.",
      suggestedFix: "Voeg een duidelijke conversion zone toe richting het einde.",
    });
    fixes.push("Voeg ten minste één sterke CTA-zone toe.");
  }

  if (metrics.averageContrast < 4) {
    warnings.push({
      code: "low_zone_contrast",
      severity: "warning",
      message: "Te weinig contrast tussen opeenvolgende zones.",
      suggestedFix: "Verander width, alignment, surface of media-priority per overgang.",
    });
    fixes.push("Verhoog contrast tussen opeenvolgende zones.");
  } else {
    strengths.push("Goede zone-contrastwisselingen.");
  }

  const heroCandidate = zones.find((z, i) => zoneIsPrimaryHeroSpatial(z, i));
  if (heroCandidate) {
    if (heroCandidate.widthMode === "contained" || heroCandidate.density === "compressed") {
      warnings.push({
        code: "hero_lacks_spatial_impact",
        severity: "warning",
        message: "Hero (of eerste impactzone) mist ruimtelijke impact.",
        affectedZoneIds: [heroCandidate.id],
        suggestedFix: "Gebruik full_bleed/canvas en meer ademruimte.",
      });
      fixes.push("Maak hero ruimtelijker en minder opgesloten.");
    }
  }

  const errorCount = warnings.filter((w) => w.severity === "error").length;
  const warningCount = warnings.filter((w) => w.severity === "warning").length;

  const score = Math.max(
    0,
    Math.min(100, 92 - errorCount * 18 - warningCount * 6 + strengths.length * 2),
  );

  return {
    score,
    strengths,
    warnings,
    fixes,
  };
}

export function setZoneWidthMode(
  plan: CompositionPlan,
  zoneId: string,
  widthMode: WidthMode,
): CompositionPlan {
  return {
    ...plan,
    compositionZones: plan.compositionZones.map((zone) =>
      zone.id === zoneId ? { ...zone, widthMode } : zone,
    ),
  };
}

export function swapZonePreferredPattern(
  plan: CompositionPlan,
  zoneId: string,
  nextPattern: ZonePattern,
): CompositionPlan {
  return {
    ...plan,
    compositionZones: plan.compositionZones.map((zone) =>
      zone.id === zoneId
        ? {
            ...zone,
            preferredPatterns: [
              nextPattern,
              ...zone.preferredPatterns.filter((p) => p !== nextPattern),
            ],
          }
        : zone,
    ),
  };
}

export function setZoneAlignment(
  plan: CompositionPlan,
  zoneId: string,
  alignmentMode: AlignmentMode,
): CompositionPlan {
  return {
    ...plan,
    compositionZones: plan.compositionZones.map((zone) =>
      zone.id === zoneId ? { ...zone, alignmentMode } : zone,
    ),
  };
}

export function repairCompositionPlan(plan: CompositionPlan): CompositionPlan {
  let next: CompositionPlan = { ...plan, compositionZones: [...plan.compositionZones] };
  const zones = next.compositionZones;

  if (zones.length < 2) {
    return { ...next, qualityReport: validateCompositionPlan(next) };
  }

  let metrics = getCompositionPlanMetrics(next);

  if (metrics.openCanvasMoments < 1 && zones[1]) {
    next = setZoneWidthMode(next, zones[1]!.id, "canvas");
  }

  metrics = getCompositionPlanMetrics(next);
  if (metrics.containedZoneStreak >= 3) {
    const target = zones.find(
      (z, i) => i > 0 && (z.widthMode === "contained" || z.widthMode === "narrow"),
    );
    if (target) next = setZoneWidthMode(next, target.id, "wide");
  }

  metrics = getCompositionPlanMetrics(next);
  if (metrics.centeredZoneStreak >= 3) {
    const target = zones.find((z, i) => i > 0 && z.alignmentMode === "centered");
    if (target) next = setZoneAlignment(next, target.id, "left_weighted");
  }

  metrics = getCompositionPlanMetrics(next);
  if (metrics.earlyProofIndex === null && zones[1]) {
    const z1 = zones[1]!;
    next = swapZonePreferredPattern(next, z1.id, "floating_proof_strip");
    next = {
      ...next,
      compositionZones: next.compositionZones.map((z, i) =>
        i === 1
          ? {
              ...z,
              role: "trust",
              intent: "credibility",
              proofIntensity: "moderate",
              ctaIntensity: "none",
            }
          : z,
      ),
    };
  }

  return {
    ...next,
    qualityReport: validateCompositionPlan(next),
  };
}

export function finalizeCompositionPlan(plan: CompositionPlan): CompositionPlan {
  const repaired = repairCompositionPlan(plan);
  return {
    ...repaired,
    qualityReport: validateCompositionPlan(repaired),
  };
}

export function getDefaultLayoutDNAForArchetype(archetype: PageCompositionArchetype): LayoutDNA {
  switch (archetype) {
    case "editorial_wave":
    case "brand_chapter_scroll":
      return { grid: "12col", gutter: "generous", verticalRhythm: "fluid", spacingUnit: 1 };
    case "saas_proof_ladder":
    case "service_trust_cta":
    case "default_professional":
      return { grid: "12col", gutter: "breathing", verticalRhythm: "modular", spacingUnit: 0.5 };
    case "commerce_discovery_stack":
    case "catalog_search_spine":
    case "hybrid_story_commerce":
      return { grid: "16col", gutter: "breathing", verticalRhythm: "event_driven", spacingUnit: 0.5 };
    case "premium_breath":
    case "health_authority_stack":
      return { grid: "12col", gutter: "generous", verticalRhythm: "fluid", spacingUnit: 1 };
    case "community_momentum":
      return { grid: "12col", gutter: "breathing", verticalRhythm: "event_driven", spacingUnit: 0.5 };
    default:
      return { grid: "12col", gutter: "breathing", verticalRhythm: "fluid", spacingUnit: 0.5 };
  }
}
