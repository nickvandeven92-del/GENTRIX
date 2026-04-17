/**
 * Beleid voor achtergrond-`<video>` in gegenereerde HTML: alleen eigen URL uit briefing of bijlagen.
 * Vaste stock-MP4's zijn verwijderd uit prompts en codebase.
 */

export function getStudioDefaultHeroVideoPromptBlock(): string {
  return `=== ACHTERGRONDVIDEO (alleen eigen URL) ===
De Studio **stuurt geen vaste stock-MP4-lijst** mee. Zet **geen** \`<video>\` met een verzonnen URL of met URL's die **niet letterlijk** in de **gebruikersbriefing** of **geüploade bijlagen** staan.

- **\`<video>\` is toegestaan** wanneer de briefing een **concrete https-URL** naar een videobestand bevat (meestal \`.mp4\` / \`.webm\`) of wanneer een bijlage-URL in de context staat: gebruik **exact die** bron, met \`autoplay muted loop playsinline\` en een donkere overlay als de kop anders slecht leesbaar is.
- **“Dynamisch”, “levendig”, “animatie”, “bewegende hero” of “subtiele beweging” zonder videobestand-URL:** gebruik **geen** stock-\`<video>\` — werk met **gradient / split-layout / klantfoto-URL**, Tailwind-transities, en studio-markeringen (\`data-animation\`, \`data-aos\`, \`studio-border-reveal\`, …) zoals elders in deze prompt (**geen** anonieme stock-URL's buiten \`gallery\`).
- **Verboden:** impliciete of “standaard” stock-video; leeg \`<video>\` zonder geldige \`source\`.`;
}
