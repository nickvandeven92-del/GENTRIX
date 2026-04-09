import {
  PAGE_COMPOSITION_ARCHETYPE_VALUES,
  type HomepagePlan,
} from "@/lib/ai/build-homepage-plan";

export type ValidationIssue = {
  severity: "error" | "warning";
  message: string;
  suggestion: string;
};

function maxConsecutiveCompact(rhythm: HomepagePlan["rhythm"]): number {
  const vals = Object.values(rhythm);
  let run = 0;
  let maxRun = 0;
  for (const v of vals) {
    if (v === "compact") {
      run++;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 0;
    }
  }
  return maxRun;
}

export function validateHomepagePlan(plan: HomepagePlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const cp = plan.compositionPlan;
  if (!(PAGE_COMPOSITION_ARCHETYPE_VALUES as readonly string[]).includes(cp.layoutArchetype)) {
    issues.push({
      severity: "error",
      message: `Onbekend compositionPlan.layoutArchetype: ${cp.layoutArchetype}`,
      suggestion: `Gebruik één van: ${PAGE_COMPOSITION_ARCHETYPE_VALUES.join(", ")}.`,
    });
  }
  if (cp.compositionZones.length < 2) {
    issues.push({
      severity: "warning",
      message: "compositionPlan.compositionZones heeft weinig zones",
      suggestion: "Voeg minstens shell + body + footer-achtige zones toe voor duidelijke paginadynamiek.",
    });
  }
  if (!cp.macroComposition.trim() || cp.macroComposition.length < 20) {
    issues.push({
      severity: "warning",
      message: "macroComposition is erg kort of leeg",
      suggestion: "Beschrijf in één zin de gewenste pagina-dynamiek voor het model.",
    });
  }

  if (cp.qualityReport) {
    for (const w of cp.qualityReport.warnings) {
      issues.push({
        severity: w.severity === "error" ? "error" : "warning",
        message: `[compositie ${w.code}] ${w.message}`,
        suggestion: w.suggestedFix ?? "",
      });
    }
  }

  const uniqueTypes = new Set(plan.sectionSequence.map((s) => s.type));
  if (uniqueTypes.size > 7) {
    issues.push({
      severity: "warning",
      message: `Veel verschillende sectietypes (${uniqueTypes.size})`,
      suggestion: "Overweeg types te combineren in dezelfde band (minder wisseling voor de bezoeker).",
    });
  }

  const primaryCount = plan.sectionSequence.filter((s) => s.priority === "primary").length;
  if (primaryCount > 4) {
    issues.push({
      severity: "error",
      message: `Te veel primaire secties (${primaryCount})`,
      suggestion: "Maximaal 4 primary; maak de rest secondary of supporting.",
    });
  }

  if (plan.sectionSequence.length > 10) {
    issues.push({
      severity: "warning",
      message: `Lange planner-sequentie (${plan.sectionSequence.length} rijen) — in productie worden canonieke secties vaak tot max. 5 gecomprimeerd.`,
      suggestion: "Houd het narratief rijk, maar verwacht dat HTML-secties samenvallen.",
    });
  }

  if (maxConsecutiveCompact(plan.rhythm) >= 3) {
    issues.push({
      severity: "warning",
      message: "Lange reeks compacte verticale ‘bands’",
      suggestion: "Wissel spacious / medium / compact voor adem en hiërarchie.",
    });
  }

  if (plan.experienceModel === "ecommerce_home" && plan.navigationModel.searchPriority === "none") {
    issues.push({
      severity: "error",
      message: "E-commerce model verwacht zoek- of discovery-ondersteuning",
      suggestion: "Zet searchImportance op supporting of primary in de intent.",
    });
  }

  if (plan.trustModel.positions.length < 2) {
    issues.push({
      severity: "warning",
      message: "Weinig trust-posities gedefinieerd",
      suggestion: "Verspreid trust (reviews, guarantees) over meerdere secties.",
    });
  }

  return issues;
}
