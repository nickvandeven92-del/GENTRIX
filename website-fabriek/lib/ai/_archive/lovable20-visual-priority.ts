/**
 * Art-direction north star. PREMIUM CONTRACT blijft technisch leidend voor exacte preset-strings + data-layout.
 */
export const LOVABLE20_VISUAL_PRIORITY = `
=== LOVABLE 2.0 — VISUAL PRIORITY (richting) ===

**Doel:** Eén **samenhangende**, art-directed pagina — \`_design_preset\` op **grote** vlakken (exacte utility-strings uit PREMIUM). Lees de pagina als **één doorlopend canvas** (zoals veel Lovable-sites): herhaal **niet** hetzelfde “sectie+container+kaarten”-patroon band na band; laat beeld, gradient of typografie **doorlopen** of visueel **verbinden** tussen zones zodat het geen checklist van losse blokken oogt. De **hero is het eerste gezicht** en moet daarom **onmiddellijk indruk maken** (beeld + schaal + actie); kaarten alleen waar het focaal helpt, niet als vervanging van een zwakke hero.

**Streef naar (flexibel — liever eigenzinnig dan veilig generiek):**
1. **Hero met karakter:** sterk beeld, stille loop-video, **of** gradient/orbs uit preset — geen slap vlak + kleine kop. Desktop-hoofdkop vaak \`text-5xl\`–\`text-8xl\` op hero-schaal; volg preset \`typography.heading\` voor familie/gewicht. **Service/B2B (transport, logistiek, installatie):** hero is **niet** “alleen drie mini-kaartjes zonder hoofdbeeld” — minstens **één grote** relevante Unsplash-foto of full-bleed achtergrond (\`min-h-[22rem]\` md+), naast eventuele tegels.
2. **Diepte op sectie-niveau:** preset \`effects.*\` + \`surfaces.section*\` op **buitenste** wrappers (hero + meestal nog een paar banden).
3. **Één moment van asymmetrie of open editorial band** — vermijd “alleen drie gelijke icoonkolommen” als heel de pagina.
4. **Framing:** niet overal dezelfde border-radius; combineer hairline (\`ring\`/\`border\` uit preset-stijl), scherp(er) kader op één module, of beeld dat de rand kruist — zolang utilities uit **preset** blijven. Op **lichte B2C/leisure** pagina’s: mag **één** zachte SVG-golfscheiding tussen hero en volgende band (inline SVG, geen \`style=\`).
5. **Beeld:** meerdere sterke Unsplash-foto’s **of** bewuste gradient/orbs; \`alt\` invullen.
6. **Eerlijkheid + contrast:** leesbare body; geen verzonnen feiten (CONTENT AUTHORITY).
7. **Nav/hero:** primaire nav **sticky** (\`navigation.wrapper\`) of **fixed top-0** op fullscreen overlay — blijft bij scroll bruikbaar zoals Lovable; lichte split-hero → lichte sticky balk.
8. **Footer:** exact \`sections.footer\` uit preset op de \`<footer>\`-wrapper — **geen** standaard zwart forceren als de preset licht is (\`minimal_light\` = lichte footerband).

**Check:** voelt het premium, warm en **niet** als standaard SaaS-template? Zo ja, leveren.
`.trim();

/** Korte vervanging als `SITE_GENERATION_MINIMAL_PROMPT=1` — geen dubbele lange north-star. */
export const LOVABLE20_VISUAL_PRIORITY_MINIMAL = `
=== Visuele richting (compact) ===
Premium en samenhangend — **één canvas**, geen monotone sectie-stapel. **PREMIUM**-techniek + exact **\_design_preset** op gekozen wrappers; **hero = eerste indruk** — dominant beeld of full-bleed, geen slap kaarten-only-openingsbeeld; footer = **sections.footer** uit preset (minimal_light = licht). Geen verzonnen feiten (CONTENT AUTHORITY).
`.trim();
