/**
 * Harde content-regels: geen verzonnen commerciële of feitelijke claims.
 * Gebruik in system/user-prompts; **afwezigheid van input = geen vrijbrief om te verzinnen**.
 */
export const CONTENT_AUTHORITY_POLICY_VERSION = "v1" as const;

/**
 * Korte prompt-sectie (Nederlands, sluit aan op studio-prompts).
 */
export function buildContentAuthorityPolicyBlock(): string {
  return `=== CONTENT AUTHORITY (geen verzonnen marketing of feiten) ===
- **Absence of data is not permission to invent.** Alleen wat **expliciet** in de briefing of bestaande bron-JSON staat, mag als feit, cijfer, prijs, review, actie of productclaim in de copy.
- **Verboden te verzinnen (tenzij letterlijk in input):** promoties en seizoensacties (o.a. Black Friday, Cyber Monday), kortingspercentages, “limited time”-urgency, testimonials/namen/citaten, klantaantallen (“trusted by 500+”), sterrenscores, prijzen en pakketten, garanties en levertijden, awards/rankings (“#1”, “marktleider”), concrete productfeatures die niet uit de briefing volgen, “24/7”-beloftes, gratis verzending/korting als die niet genoemd is.
- **Ook verboden zonder bron:** jubilea en ervaringsclaims (“25+ jaar”, “online sinds …”), project- of klanttellingen (“500+ projecten”), certificaat- of keurmerkregels (ISO/CE/VCA e.d.), fictieve KvK/BTW-nummers of adresregels — geen placeholder-cijfers om de pagina “voller” te laten lijken.
- **Beeld (Unsplash/stock):** kies **branche-passende** foto’s (transport → wegen/vracht/logistiek; geen speelgoed, games of willekeurige “grappige” placeholders in trust/hero).
- **Wel toegestaan:** neutrale, professionele formuleringen (“Neem contact op”, “Meer informatie”), algemene dienstomschrijving **zonder** fake cijfers, **geen** prijsblokken/testimonialrasters als de briefing die niet geeft — liever **minimale, eerlijke** copy dan opvulmarketing.
- **Secties:** Geen pricing-, review- of “social proof”-sectie vullen met **fictieve** inhoud. Onderwerp weglaten, versimpelen, of één zin neutrale CTA is beter dan bullshit.`;
}

/** Compacte regels voor debug/logging (geen volledige prompt). */
export function getContentAuthorityRulesSummary(): readonly string[] {
  return [
    "no_invented_promotions_or_discounts",
    "no_invented_testimonials_or_stats",
    "no_invented_pricing_or_guarantees",
    "no_invented_features_or_awards",
    "neutral_copy_when_data_absent",
  ] as const;
}
