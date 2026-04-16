/**
 * Branche-profielen en keyword-routing voor site-generatie.
 * Gescheiden van generate-site-with-claude.ts voor leesbaarheid en onderhoud.
 */

export type IndustryProfile = {
  id: string;
  label: string;
  sections: readonly string[];
  heroStrategy: "photo" | "typographic" | "product";
  servicesFormat: "price-list" | "card-grid" | "split" | "spotlight";
  vibe: string;
  promptHint: string;
  /**
   * Strikte one-pager (`faq`-sectie): aan als `sections` al `faq` bevat **of** hier `true`
   * (veel praktische vragen: openingstijden, boeken, tarieven, bezichtiging, …).
   */
  compactLandingDefaultFaq?: boolean;
};

/**
 * Strikte one-pager: `faq` in het compacte plan als het profiel dat impliciet wil —
 * via `sections` (al met `faq`) of via `compactLandingDefaultFaq`.
 */
export function industryProfilePrefersCompactLandingFaq(profile: IndustryProfile | null): boolean {
  if (!profile) return false;
  if (profile.sections.includes("faq")) return true;
  return profile.compactLandingDefaultFaq === true;
}

export const INDUSTRY_PROFILES: IndustryProfile[] = [
  {
    id: "barber",
    label: "Barbershop / Herenkapper",
    sections: ["hero", "features", "gallery", "about", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: BARBERSHOP / HERENKAPPER**
Dit is een **herenkapper of barbershop** — specifiek gericht op mannen. Denk aan de sfeer van een premium herenkapperszaak: vakmanschap, traditie, masculiene elegantie.
- **Hero-idee:** grote cinematic foto (interieur met stoelen/spiegels, warm licht) die **het beeld vult**; kop in **elegant serif**, kort (paar woorden), **geen** lange paragraaf in de hero — uitleg pas onder de vouw. Vermijd "billboard" all-caps extrabold sans + twee grote knoppen (voelt goedkoop). **Geen** achtergrond-\`<video>\` tenzij de briefing **expliciet** om bewegende achtergrond / video / loop vraagt — standaard **Unsplash-foto**.
- **Diensten-idee:** een elegante verticale prijslijst (\`divide-y\`) werkt hier vaak beter dan kaarten — het voelt als een menukaart. Maar een creatief grid kan ook werken als het past.
- **Content:** focus op herenknippen, baardverzorging, hot towel shave, traditioneel scheren. Doelgroep is mannelijk. Gebruik woorden als "heren", "gentleman", "vakmanschap".
- **Typische elementen:** werkplaats-galerij, WhatsApp-booking, openingstijden. **Geen** verplichte "merken-rij" — alleen als de briefing expliciet merken/partners/producten noemt (dan wordt sectie \`brands\` via keywords toegevoegd).`,
  },
  {
    id: "hair_salon",
    label: "Kapsalon / Haarsalon (unisex)",
    sections: ["hero", "features", "gallery", "about", "team", "brands", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: KAPSALON / HAARSALON (UNISEX)**
Dit is een kapsalon die zowel dames als heren bedient. Focus op haarverzorging, styling, kleurbehandelingen en persoonlijke aandacht voor iedereen.
- **Hero-idee:** stijlvol salon-interieur of close-up haar; **minimale copy** in de hero (korte kop + optioneel één regel), serif-kop, veel negatieve ruimte — luxe voelt rustig, niet druk.
- **Diensten-idee:** een elegante prijslijst per categorie, gescheiden in **Dames** en **Heren** (of apart: Knippen, Kleuren, Behandelingen). Prijzen in euro's. Menukaart-gevoel.
- **Content:** breed scala — knippen dames & heren, kleuren, highlights/balayage, keratine, föhnen/stylen, baardtrimmen. Toon dat iedereen welkom is.
- **Team:** stylisten met specialisaties. Portretfoto's en korte bio's.
- **Typische elementen:** behandelingenmenu (dames + heren), team van stylisten, resultaat-galerij, merkpartners (Kérastase, Olaplex, Redken, etc.), online booking-CTA, openingstijden.`,
  },
  {
    id: "womens_salon",
    label: "Dameskapsalon",
    sections: ["hero", "features", "gallery", "about", "team", "brands", "testimonials", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: DAMESKAPSALON**
Dit is een kapsalon specifiek voor vrouwen. De sfeer is vrouwelijk, verfijnd en verwennend. De website moet het gevoel geven van een luxe me-time ervaring.
- **Hero-idee:** beeld-gedreven, grote hero; elegante **serif**-kop, weinig tekst; geen volle alinea onder de kop in de eerste sectie.
- **Diensten-idee:** elegante prijslijst per categorie: Knippen & Stylen, Kleurbehandelingen (highlights, balayage, ombré, volledige kleuring), Behandelingen (keratine, haarmaskers, hoofdhuidbehandeling), Specials (bruidsstyling, extensions, opsteekkapsels). Menukaart-gevoel met subtiele categoriekoppen.
- **Content:** vrouwelijke doelgroep. Diensten als balayage, highlights, ombré, extensions, bruidsstyling, keratine-behandelingen, föhnen & stylen, krullenknip. Gebruik woorden als "verwennerij", "transformatie", "jouw moment", "stralen".
- **Team:** stylisten (vrouwelijke termen: "onze stylistes") met specialisaties en portretfoto's.
- **Foto's:** vrouwen met prachtig haar, salon-interieur met vrouwelijke sfeer, close-ups van kleurresultaten. Unsplash zoektermen: "woman hair salon", "hair coloring", "balayage hair", "bridal hairstyle".
- **Typische elementen:** uitgebreid behandelingenmenu, voor/na galerij (kleurresultaten), team stylistes, merkpartners (Kérastase, L'Oréal Professionnel, Olaplex, Davines), reviews van klanten, online booking-CTA, openingstijden.`,
  },
  {
    id: "retail_electronics",
    label: "Elektronica / Tech winkel",
    sections: ["hero", "shop", "features", "about", "faq", "footer"],
    heroStrategy: "product",
    servicesFormat: "spotlight",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: ELEKTRONICA / TECH WINKEL**
Denk aan Apple, Bang & Olufsen, of een premium tech-webshop. Het product is de ster — de website is het podium.
- **Hero-idee:** één uitgelicht product centraal — **donkere studio** óf **heldere/minimale lichte** achtergrond (Apple-achtig wit/grijs); kies wat de briefing of referentie het beste ondersteunt. Product "zweeft" visueel. Minimal copy, maximaal visueel.
- **Shop-idee:** individuele product-showcases als cinematic full-bleed secties (VOLTEX-stijl). Of een strak productgrid. Winkelwagen-icoon in de nav.
- **Sfeer-richting:** strak, high-end, minimale typografie, product centraal — **dark mode is één optie**, geen verplichting; licht + diep accent (blauw, teal, zwart-inkt) is even geldig.
- **Typische elementen:** productcategorieën in nav, USP-rij (verzending, garantie), newsletter.`,
  },
  {
    id: "garage",
    label: "Autogarage / Werkplaats",
    sections: ["hero", "features", "about", "gallery", "brands", "testimonials", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "industrial",
    promptHint: `**BRANCHE-INSPIRATIE: AUTOGARAGE / WERKPLAATS**
Denk aan betrouwbaarheid, vakmanschap, technische expertise. De klant moet vertrouwen voelen.
- **Hero-idee:** werkplaats met auto op de brug, of monteur aan het werk. Industriële sfeer met donkere overlay.
- **Diensten-idee:** grid met iconen werkt goed (APK, onderhoud, banden, etc.). Of een compacte lijst als er veel diensten zijn.
- **Sfeer-richting:** industrieel, donkere secties, bold sans-serif. Donkerblauw of rood accent. Moersleutel/tandwiel als decoratie.
- **Typische elementen:** certificeringen, werkplaatsfoto's, klantreviews (vertrouwen!), automerken-rij.`,
  },
  {
    id: "transport",
    label: "Transport / Logistiek",
    sections: ["hero", "features", "about", "brands", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "corporate",
    promptHint: `**BRANCHE-INSPIRATIE: TRANSPORT / LOGISTIEK**
Denk B2B, professioneel, betrouwbaar. De klant is een bedrijf dat een partner zoekt, geen consument die een product koopt.
- **Hero-idee:** vloot op de weg, vrachtwagens, snelweg bij zonsondergang. Professionele uitstraling.
- **Diensten-idee:** card-grid met iconen per dienst. Of een overzichtelijke tabel. Weinig visuele flair, veel duidelijkheid.
- **Sfeer-richting:** corporate, donkerblauw of diepgroen, wit/grijs secties. Sans-serif, zakelijk.
- **Typische elementen:** vloot/capaciteitscijfers, klantlogo-rij (B2B vertrouwen), zakelijke testimonials, offerte-CTA.`,
  },
  {
    id: "realestate",
    label: "Makelaar / Vastgoed",
    sections: ["hero", "features", "gallery", "about", "testimonials", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: MAKELAAR / VASTGOED**
Denk aan luxe, aspiratie, droomhuizen. De website moet de levensstijl verkopen, niet alleen het huis.
- **Hero-idee:** luxe woning (daglicht of avond — beide kunnen), stijlvol licht interieur, of architectuur in neutrale tonen. Premium, aspirationeel. Of een typografische hero met "Vind uw droomwoning" in groot serif op **licht** canvas.
- **Woningen-idee:** spotlight-cards met grote foto, locatie, prijs, m². Of een uitgelichte woning als cinematic full-bleed sectie.
- **Sfeer-richting:** luxe met **crème/stone/wit** als dominante basis; navy of donkergroen als accent of voor typografie — **niet** verplicht een donker hoogtepunt in elke sectie. Serif-koppen. Sleutel/huis SVG's.
- **Typische elementen:** woning-galerij, team met portretfoto's, lokale expertise, bezichtiging-CTA.`,
  },
  {
    id: "restaurant",
    label: "Restaurant / Horeca",
    sections: ["hero", "features", "gallery", "about", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: RESTAURANT / HORECA**
Denk aan een uitnodiging om te komen eten. Warmte, smaak, sfeer. De website is de eerste gang.
- **Hero-idee:** sfeervolle gerechten, warm verlicht interieur, of chef aan het werk. Of een typografische hero met restaurantnaam in elegant serif.
- **Menu-idee:** een elegante verticale lijst (\`divide-y\`) per gang werkt vaak editorial. Maar een visueel menu met foto's per gerecht kan ook sterk zijn.
- **Sfeer-richting:** warm — wissel **lichte** crème/beige secties met rijke donkere accenten **als** dat past; goud/koper accent, serif-typografie. Vork/mes als decoratie.
- **Typische elementen:** menu/kaart, sfeergalerij, verhaal van de chef, reserveer-CTA, openingstijden.`,
  },
  {
    id: "beauty",
    label: "Schoonheidssalon / Beauty",
    sections: ["hero", "features", "gallery", "team", "testimonials", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: SCHOONHEIDSSALON / BEAUTY**
Denk aan luxe, zelfzorg, verwennerij. De website moet het gevoel geven dat je al ontspant bij het bekijken.
- **Hero-idee:** salon-interieur, close-up behandeling, of puur typografisch met elegante serif op zachte achtergrond.
- **Behandelingen-idee:** prijslijst per categorie werkt vaak elegant. Of visuele kaarten met sfeerbeelden per behandeling.
- **Sfeer-richting:** zacht, luxe. Roze/mauve/nude accent, crème achtergronden, serif-koppen. Bloemblaadjes/spiegel als decoratie.
- **Typische elementen:** behandelingenmenu, teamportretten, voor/na galerij, booking-CTA, reviews.`,
  },
  {
    id: "construction",
    label: "Bouw / Constructie",
    sections: ["hero", "features", "gallery", "about", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "industrial",
    promptHint: `**BRANCHE-INSPIRATIE: BOUW / CONSTRUCTIE**
Denk aan kracht, ambitie, vakmanschap. Grote projecten, betrouwbare handen.
- **Hero-idee:** bouwplaats bij zonsondergang, lasser met vonken, staalconstructie. Of een krachtige typografische hero met bold sans-serif.
- **Diensten-idee:** card-grid met iconen werkt goed. Of een portfolio-stijl met projectfoto's als dienst-illustratie.
- **Sfeer-richting:** industrieel, donkerblauw of oranje/amber accent, donkere secties. Bold sans-serif. Helm/moersleutel SVG's.
- **Typische elementen:** projectenportfolio, certificeringen, teamfoto, offerte-CTA.`,
  },

  // ── MODE & KLEDING ──────────────────────────────────────────────────
  {
    id: "mens_fashion",
    label: "Herenkleding / Herenmode",
    sections: ["hero", "shop", "features", "about", "gallery", "brands", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: HERENKLEDING / HERENMODE**
Stijl, kwaliteit en mannelijke elegantie. De website is de digitale etalage — elk item moet er uitzien alsof het in een magazine staat.
- **Hero-idee:** man in stijlvolle outfit — **licht editorial** (off-white, natuurlijk licht) óf donker met sfeervolle belichting; of typografisch met bold serif en merk-statement.
- **Producten-idee:** cinematic product-showcases met grote lifestyle-foto's. Categorieën: pakken, overhemden, casual, accessoires. Prijzen in euro's.
- **Content:** focus op kwaliteit, materialen, pasvorm, tijdloze stijl. Woorden als "vakmanschap", "Italiaans katoen", "slim fit", "maatwerk".
- **Typische elementen:** collectie-overzicht, merk-filosofie, lookbook-galerij, merkpartners, nieuwsbrief-aanmelding.`,
  },
  {
    id: "womens_fashion",
    label: "Dameskleding / Damesmode",
    sections: ["hero", "shop", "features", "about", "gallery", "brands", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: DAMESKLEDING / DAMESMODE**
Mode, elegantie en vrouwelijke kracht. De website moet de collectie presenteren als een visueel verhaal — aspirationeel, stijlvol, uitnodigend.
- **Hero-idee:** model in key-piece van de collectie, of typografisch met elegante serif. Seizoenscollectie centraal.
- **Producten-idee:** visuele categorieën met lifestyle-fotografie (jurken, tops, broeken, accessoires). Grote beelden, minimale tekst. Prijzen in euro's.
- **Content:** focus op trends, stoffen, duurzaamheid, vrouwelijkheid. Woorden als "collectie", "nieuwe seizoen", "tijdloos", "handgemaakt".
- **Typische elementen:** collectie-pagina, lookbook/editorial galerij, over het merk, merkwaarden (duurzaamheid?), nieuwsbrief, Instagram-feed.`,
  },
  {
    id: "kids_clothing",
    label: "Baby- & Kinderkleding",
    sections: ["hero", "shop", "features", "about", "gallery", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: BABY- & KINDERKLEDING**
Lief, zacht en betrouwbaar. Ouders zoeken kwaliteit, comfort en veiligheid voor hun kinderen.
- **Hero-idee:** schattige kinderen in kleurrijke outfits, zachte kleuren, speels maar niet druk. Of een warme typografische hero.
- **Producten-idee:** categorieën per leeftijd (baby 0-2, peuter 2-4, kids 4-8) of type (rompertjes, jurkjes, jasjes). Warme, uitnodigende presentatie.
- **Content:** nadruk op comfort, biologisch katoen, OEKO-TEX, hypoallergeen, duurzaam. Vertrouwenwekkend voor ouders.
- **Typische elementen:** leeftijdscategorieën, materiaalinformatie, cadeausets, klantenreviews van ouders, retourbeleid.`,
  },
  {
    id: "shoes",
    label: "Schoenenwinkel",
    sections: ["hero", "shop", "features", "about", "brands", "footer"],
    heroStrategy: "product",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: SCHOENENWINKEL**
Schoenen zijn statement-pieces. De website moet elk paar presenteren als een object van verlangen.
- **Hero-idee:** close-up van een premium schoen op een stijlvolle achtergrond. Product centraal, minimal copy.
- **Producten-idee:** categorieën: heren, dames, sneakers, klassiek, sport. Grote productfoto's, prijzen, beschikbare maten.
- **Content:** focus op comfort, kwaliteit, merken, pasvorm-advies. "Van sneaker tot nette schoen."
- **Typische elementen:** merken-overzicht, maattabel/pasadvies, categorienavigatie, seizoenshighlights.`,
  },
  {
    id: "jewelry",
    label: "Juwelier / Sieraden",
    sections: ["hero", "shop", "features", "about", "gallery", "brands", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: JUWELIER / SIERADEN**
Luxe, exclusiviteit en emotie. Sieraden markeren momenten — verloving, jubileum, zelfbeloning. De website moet dat gevoel oproepen.
- **Hero-idee:** close-up van een sieraad — **fluweel/zwart** óf **licht marmer/porselein/studio-wit** met dramatisch licht; beide zijn luxe. Of typografisch met elegant serif en goud-accent.
- **Producten-idee:** spotlight-presentatie per categorie: ringen, kettingen, armbanden, horloges, trouwringen. Studio-kwaliteit foto's.
- **Content:** nadruk op vakmanschap, edelstenen, karaat, handgemaakt, graveerservice. Emotioneel taalgebruik.
- **Typische elementen:** collectie per categorie, trouwringen-sectie, graveerservice, merkpartners (Rolex, Swarovski?), afspraak-CTA.`,
  },

  // ── WINKELS & RETAIL ────────────────────────────────────────────────
  {
    id: "florist",
    label: "Bloemenwinkel / Florist",
    sections: ["hero", "shop", "features", "about", "gallery", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: BLOEMENWINKEL / FLORIST**
Kleur, leven en emotie. Bloemen zijn voor vreugde, troost en liefde. De website moet dat uitstralen.
- **Hero-idee:** weelderig boeket in close-up, of bloemist aan het werk in de winkel. Warme, natuurlijke belichting.
- **Producten-idee:** categorieën: boeketten, bruiloft, rouw, planten, seizoensarrangementen. Grote kleurrijke foto's.
- **Content:** bestelservice, bezorging, seizoensbloemen, abonnementen, bruidswerk. Warm en persoonlijk.
- **Typische elementen:** bestel-CTA, bezorggebied, seizoensaanbod, bruidswerk-galerij, abonnementen.`,
  },
  {
    id: "interior",
    label: "Interieur / Meubelzaak",
    sections: ["hero", "shop", "features", "about", "gallery", "brands", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: INTERIEUR / MEUBELZAAK**
Design, sfeer en levensstijl. De website verkoopt niet alleen meubels — het verkoopt een manier van leven.
- **Hero-idee:** prachtig gestyled interieur, of een signature meubelstuk als centerpiece. Aspirationeel.
- **Producten-idee:** spotlight per categorie: woonkamer, slaapkamer, eetkamer, verlichting, accessoires. Lifestyle-contexfoto's.
- **Content:** designfilosofie, materialen, duurzaamheid, interieuradvies. Inspirerend, niet catalogus-achtig.
- **Typische elementen:** interieurinspiratie-galerij, merkpartners, stijladvies/blog, showroom-info, afspraak-CTA.`,
  },
  {
    id: "bike_shop",
    label: "Fietsenwinkel",
    sections: ["hero", "shop", "features", "about", "brands", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: FIETSENWINKEL**
Mobiliteit, vrijheid en duurzaamheid. Van stadsfietsen tot e-bikes tot racefietsen.
- **Hero-idee:** fietser in actie of premium fiets in studioverlichting. Dynamisch en energiek.
- **Producten-idee:** categorieën: stadsfietsen, e-bikes, racefietsen, kinderfietsen, accessoires. Specificaties + prijzen.
- **Content:** merken, proefritten, onderhoud/reparatie-service, financiering, inruil. Actief en adviserend.
- **Typische elementen:** merken-rij, onderhoudspakketten, proefrit-CTA, werkplaats-info, financieringsmogelijkheden.`,
  },
  {
    id: "pet_store",
    label: "Dierenwinkel / Dierenspeciaalzaak",
    sections: ["hero", "shop", "features", "about", "gallery", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: DIERENWINKEL / DIERENSPECIAALZAAK**
Liefde voor dieren. De website spreekt dierenliefhebbers aan — warm, betrouwbaar, deskundig advies.
- **Hero-idee:** schattige dieren (hond, kat) met eigenaar, of een goed gevulde winkel. Warm en uitnodigend.
- **Producten-idee:** categorieën per diersoort: hond, kat, vogel, vis, knaagdier. Voeding, speelgoed, verzorging.
- **Content:** deskundig advies, premium merken, voedingsadvies, trimsalon (als aangeboden).
- **Typische elementen:** diersoort-categorieën, merkpartners, trimsalon-info, loyaliteitsprogramma, adviesblog.`,
  },
  {
    id: "optician",
    label: "Optiek / Opticien",
    sections: ["hero", "features", "about", "gallery", "brands", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: OPTIEK / OPTICIEN**
Gezondheid meets mode. Brillen zijn functioneel én een fashion-accessoire.
- **Hero-idee:** stijlvolle bril in close-up, of model met designer-montuur. Clean en modern.
- **Diensten-idee:** oogmeting, contactlenzen, zonnebrillen, kinderbrillen, sportbrillen. Combinatie van zorg en mode.
- **Content:** expertise in oogzorg, trends in monturen, verzekering/vergoeding-info, merken.
- **Typische elementen:** merken-carrousel (Ray-Ban, Gucci, etc.), oogmeting-CTA, collectie-overzicht, verzekeringinfo.`,
  },
  {
    id: "sports_store",
    label: "Sportwinkel",
    sections: ["hero", "shop", "features", "about", "brands", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: SPORTWINKEL**
Energie, prestatie en passie voor sport. De website moet activeren en motiveren.
- **Hero-idee:** atleet in actie, of premium sportschoen/uitrusting op dynamische achtergrond.
- **Producten-idee:** categorieën per sport: hardlopen, fitness, voetbal, tennis, outdoor. Of per type: schoenen, kleding, uitrusting.
- **Content:** expertise, persoonlijk advies, loopanalyse, teamkleding. Energiek en deskundig.
- **Typische elementen:** sportcategorieën, merkpartners (Nike, Adidas, etc.), loopanalyse/advies-CTA, teamkleding-info.`,
  },
  {
    id: "angling_shop",
    label: "Hengelsport / Viswinkel",
    sections: ["hero", "shop", "features", "gallery", "about", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "split",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: HENGELSPORT / VISWINKEL (specialist)**
Rust, water, vakmanschap en serieuze uitrusting — **niet** dezelfde vibe als een fitness-sportwinkel of generieke SaaS-landing.
- **Hero-idee:** full-bleed **water / ochtendnevel / boot / vislijn** (Unsplash: fishing rod lake, fly fishing, tackle close-up); kop in **elegant serif** + korte subkop; **geen** willekeurige stock die niets met vissen te maken heeft. Donker+diep **of** licht+editorial — kies één lijn en volg die.
- **Compositie:** wissel **split** (foto + copy), **editoriale** banden, horizontale USP-rij met \`studio-border-reveal--h\` onder koppen — **niet** overal dezelfde drie ronde kaarten met hetzelfde icoon-patroon.
- **Shop/nav:** \`shop\`-sectie komt server-side; zet webshop-placeholder in nav/footer. Categorie-denkrichting: hengels, molens, kunstaas, lijn, kleding, accessoires — alleen als het de briefing volgt.
- **Galerij:** echte hengel-/natuur-scènes; geen “random nature leaf” zonder visserij-context.
- **Motion:** bij briefing over dynamiek/interactie: \`data-animation\`, \`studio-marquee\` met vaktermen, \`studio-border-reveal\` — geen cyber-laser tenzij de klant dat expliciet zo noemt.`,
  },
  {
    id: "bakery",
    label: "Bakkerij / Patisserie",
    sections: ["hero", "features", "about", "gallery", "shop", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: BAKKERIJ / PATISSERIE**
Ambacht, geur en smaak. De website moet het gevoel oproepen dat je de versgebakken broden ruikt.
- **Hero-idee:** warm verlicht interieur met versgebakken brood, of close-up van een perfect croissant. Ambachtelijk.
- **Producten-idee:** categorieën: brood, gebak, taarten, bestellen voor feestjes. Mooie foodfotografie.
- **Content:** ambacht, dagvers, biologisch, recepten, bestelservice. Warm en persoonlijk.
- **Typische elementen:** dagaanbod, taarten op bestelling, openingstijden, ingrediënten-filosofie, feest-/bruiloftstaarten.`,
  },
  {
    id: "butcher",
    label: "Slagerij / Traiteur",
    sections: ["hero", "features", "about", "gallery", "shop", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: SLAGERIJ / TRAITEUR**
Vakmanschap, kwaliteit en smaak. De website moet vertrouwen wekken in de kwaliteit van het vlees.
- **Hero-idee:** ambachtelijke slager aan het werk, of premium vleesstuk op houten snijplank. Warm verlicht.
- **Producten-idee:** categorieën: vers vlees, worst, charcuterie, traiteur/catering, BBQ-pakketten. Seizoensproducten.
- **Content:** herkomst van het vlees, ambacht, huisgerookt, traiteurservice, feestdagen-bestellingen.
- **Typische elementen:** weekaanbiedingen, traiteurmenu, bestelformulier, herkomstverhaal, BBQ-seizoen-specials.`,
  },
  {
    id: "liquor_store",
    label: "Slijterij / Wijnhandel",
    sections: ["hero", "shop", "features", "about", "gallery", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: SLIJTERIJ / WIJNHANDEL**
Smaak, kennis en ontdekking. De website moet de passie voor wijn, whisky en spirits overbrengen.
- **Hero-idee:** wijnkelder of sfeervolle fles in dramatische belichting. Warm, premium, uitnodigend.
- **Producten-idee:** categorieën: wijn, whisky, gin, champagne, geschenksets. Eventueel per regio of druif.
- **Content:** expertise, proeverijen, advies op maat, geschenkservice. Kennisvol maar toegankelijk.
- **Typische elementen:** proeverij-agenda, wijn-van-de-maand, geschenksets, bezorgservice, wijnadvies-CTA.`,
  },
  {
    id: "bookstore",
    label: "Boekwinkel",
    sections: ["hero", "features", "about", "gallery", "shop", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: BOEKWINKEL**
Kennis, verbeelding en rust. De website moet de sfeer van een fijne boekwinkel oproepen.
- **Hero-idee:** gezellig winkelinterieur met boekenkasten, of een curated stapel boeken. Warm, uitnodigend.
- **Producten-idee:** aanraders, top 10, genres, kinderboeken, cadeausets. Persoonlijke aanbevelingen.
- **Content:** leesclubs, signeersessies, persoonlijk advies, bestellen en afhalen. Literair en persoonlijk.
- **Typische elementen:** boek-van-de-maand, leesclub-info, evenementenagenda, cadeaubon, bestellen.`,
  },

  // ── ETEN & DRINKEN ──────────────────────────────────────────────────
  {
    id: "cafe",
    label: "Café / Koffiebar",
    sections: ["hero", "features", "about", "gallery", "footer"],
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: CAFÉ / KOFFIEBAR**
Gezelligheid, goede koffie en een plek om tot rust te komen. De website is de uitnodiging om binnen te stappen.
- **Hero-idee:** sfeervol interieur met dampende koffie, of latte art in close-up. Warm en uitnodigend.
- **Menu-idee:** elegante lijst: koffie, thee, gebak, lunch. Prijslijst met categorieën.
- **Content:** koffiebonen-herkomst, barista-expertise, huisgemaakte gebakjes, wifi/werkplek. Ontspannen toon.
- **Typische elementen:** menu/kaart, interieur-galerij, openingstijden, locatie met kaart, evenementen.`,
  },
  {
    id: "ice_cream",
    label: "IJssalon",
    sections: ["hero", "features", "about", "gallery", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: IJSSALON**
Vreugde, smaken en zomer. De website moet je doen watertanden en naar de winkel lokken.
- **Hero-idee:** kleurrijk ijs in close-up, of gelukkige mensen met een ijsje. Levendig, vrolijk.
- **Smaken-idee:** visuele kaarten per smaak met kleurrijke fotografie. Seizoensspcials uitlichten.
- **Content:** ambachtelijk, vers bereid, natuurlijke ingrediënten, seizoenssmaken, allergeen-info.
- **Typische elementen:** smakenkaart, seizoensspecials, catering/feestjes, locatie + openingstijden.`,
  },
  {
    id: "foodtruck",
    label: "Foodtruck / Street Food",
    sections: ["hero", "features", "about", "gallery", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: FOODTRUCK / STREET FOOD**
Lekker, snel en met karakter. De foodtruck is een merk op wielen — de website moet die energie vangen.
- **Hero-idee:** de truck zelf in actie, of een signature gerecht in close-up. Bold, energiek.
- **Menu-idee:** compacte menukaart met foto's van elk gerecht. Prijzen in euro's.
- **Content:** het verhaal achter de truck, waar te vinden (locaties/evenementen), boeken voor feestjes/events.
- **Typische elementen:** menu, locatie-agenda ("waar staan we"), boekings-CTA voor events, social media.`,
  },
  {
    id: "catering",
    label: "Catering",
    sections: ["hero", "features", "about", "gallery", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: CATERING**
Ontzorgen, kwaliteit en een onvergetelijk evenement. De website moet vertrouwen wekken en inspireren.
- **Hero-idee:** prachtig gedekte tafel, of culinair hoogstandje in close-up. Aspirationeel, feestelijk.
- **Diensten-idee:** categorieën: bruiloften, bedrijfsevenementen, privéfeesten, walking dinner, BBQ-catering.
- **Content:** menu-opties, persoonlijke afstemming, dieetwensen, referenties. Professioneel maar warm.
- **Typische elementen:** menu-opties/pakketten, referenties, galerij van evenementen, offerte-CTA, FAQ.`,
  },

  // ── GEZONDHEID & WELZIJN ────────────────────────────────────────────
  {
    id: "dentist",
    label: "Tandarts",
    sections: ["hero", "features", "about", "team", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: TANDARTS**
Vertrouwen, zorg en professionaliteit. Veel mensen zijn nerveus voor de tandarts — de website moet geruststellen.
- **Hero-idee:** vriendelijke tandarts met patiënt, of modern interieur van de praktijk. Licht, schoon, vertrouwenwekkend.
- **Diensten-idee:** card-grid: controle, vullingen, kronen, implantaten, bleaching, orthodontie. Duidelijk en informatief.
- **Content:** team-introductie is cruciaal (gezichten geven vertrouwen), angstpatiënten, kindertandheelkunde, verzekeringinfo.
- **Typische elementen:** team met foto's, behandelingen-overzicht, spoed-info, online afspraak-CTA, verzekeringinfo, FAQ.`,
  },
  {
    id: "physiotherapy",
    label: "Fysiotherapie",
    sections: ["hero", "features", "about", "team", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: FYSIOTHERAPIE**
Herstel, beweging en preventie. De website moet professioneel en menselijk zijn — de patiënt moet zich begrepen voelen.
- **Hero-idee:** fysiotherapeut aan het werk met patiënt, of iemand die weer beweegt na behandeling. Positief, actief.
- **Diensten-idee:** card-grid: manuele therapie, sportfysio, revalidatie, dry needling, echografie. Informatief.
- **Content:** team met specialisaties, verwijzing/direct toegankelijk, vergoedingen, klachten-overzicht.
- **Typische elementen:** klachten-navigator, team specialisaties, online afspraak, vergoedingen-info, locatie.`,
  },
  {
    id: "psychologist",
    label: "Psycholoog / Therapeut",
    sections: ["hero", "features", "about", "team", "faq", "footer"],
    heroStrategy: "typographic",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: PSYCHOLOOG / THERAPEUT**
Veiligheid, vertrouwen en rust. De website moet een gevoel van kalmte en begrip uitstralen — laagdrempelig maar professioneel.
- **Hero-idee:** typografisch werkt hier het best — rustige achtergrond, empathische kop. Geen stockfoto's van "gelukkige mensen". Authentiek.
- **Diensten-idee:** behandelvormen: individuele therapie, relatietherapie, EMDR, cognitieve gedragstherapie, coaching.
- **Content:** werkwijze, eerste afspraak uitleg, vergoedingen (BIG-registratie, contractvrij), wachtlijst-info. Laagdrempelig.
- **Typische elementen:** werkwijze-uitleg, intake-info, vergoedingen/tarieven, contact-CTA (niet te pushy), over de therapeut.`,
  },
  {
    id: "medical",
    label: "Huisarts / Kliniek",
    sections: ["hero", "features", "about", "team", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: HUISARTS / KLINIEK**
Toegankelijkheid, zorg en betrouwbaarheid. De website is praktisch — patiënten zoeken info en willen snel een afspraak maken.
- **Hero-idee:** modern praktijkgebouw of vriendelijk team. Professioneel, toegankelijk.
- **Diensten-idee:** overzicht van spreekuren, vaccinaties, chronische zorg, GGZ, jeugdzorg. Informatief en overzichtelijk.
- **Content:** team-introductie, openingstijden, spoedinfo, herhaalrecepten, e-consult, inschrijven als patiënt.
- **Typische elementen:** spoednummer prominent, openingstijden, team, online afspraak, patiënt-inschrijving, FAQ.`,
  },
  {
    id: "spa_wellness",
    label: "Spa / Wellness",
    sections: ["hero", "features", "about", "gallery", "team", "footer"],
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: SPA / WELLNESS**
Ontspanning, luxe en zelfzorg. De website moet het gevoel geven dat je al ontspant bij het bekijken.
- **Hero-idee:** sereen spa-interieur, waterdruppels, kaarslicht. Of typografisch met elegant serif op rustige achtergrond.
- **Behandelingen-idee:** elegante prijslijst per categorie: massages, gezichtsbehandelingen, body wraps, sauna-arrangementen.
- **Content:** rust, rituelen, premium producten, duo-arrangementen, cadeaubonnen. Serene, rustige toon.
- **Typische elementen:** arrangementen/pakketten, cadeaubonnen, openingstijden, faciliteiten-overzicht, boekings-CTA.`,
  },

  // ── ZAKELIJKE DIENSTEN ──────────────────────────────────────────────
  {
    id: "lawyer",
    label: "Advocaat / Juridisch",
    sections: ["hero", "features", "about", "team", "testimonials", "faq", "footer"],
    heroStrategy: "typographic",
    servicesFormat: "card-grid",
    vibe: "corporate",
    promptHint: `**BRANCHE-INSPIRATIE: ADVOCAAT / JURIDISCH KANTOOR**
Autoriteit, betrouwbaarheid en deskundigheid. De website moet vertrouwen wekken — de cliënt heeft een serieus probleem.
- **Hero-idee:** typografisch met krachtig statement. Of kantoor-interieur. Geen cliché-rechter-hamer-stockfoto's.
- **Rechtsgebieden-idee:** card-grid: ondernemingsrecht, arbeidsrecht, familierecht, strafrecht, vastgoedrecht.
- **Content:** team met CV's en specialisaties, werkwijze, eerste gesprek (gratis?), resultaten/referenties.
- **Typische elementen:** rechtsgebieden, team + specialisaties, contact/intake-CTA, publicaties/blog, lidmaatschappen.`,
  },
  {
    id: "notary",
    label: "Notaris",
    sections: ["hero", "features", "about", "team", "faq", "footer"],
    heroStrategy: "typographic",
    servicesFormat: "card-grid",
    vibe: "corporate",
    promptHint: `**BRANCHE-INSPIRATIE: NOTARIS**
Betrouwbaarheid, formaliteit en onafhankelijkheid. De website moet professioneel en helder zijn.
- **Hero-idee:** typografisch, zakelijk, klassiek. Het kantoor als betrouwbare instantie.
- **Diensten-idee:** card-grid: koopakte, testament, huwelijksvoorwaarden, oprichten BV, schenking, volmacht.
- **Content:** wat doet een notaris, tarieven/transparantie, team, bereikbaarheid. Helder en informatief.
- **Typische elementen:** diensten-overzicht, tarieventransparantie, team, checklist documenten, contact/afspraak-CTA.`,
  },
  {
    id: "accountant",
    label: "Accountant / Boekhouder",
    sections: ["hero", "features", "about", "team", "testimonials", "faq", "footer"],
    heroStrategy: "typographic",
    servicesFormat: "card-grid",
    vibe: "corporate",
    promptHint: `**BRANCHE-INSPIRATIE: ACCOUNTANT / BOEKHOUDER**
Betrouwbaarheid, financieel inzicht en ontzorging. De klant wil zekerheid dat de financiën in goede handen zijn.
- **Hero-idee:** typografisch met vertrouwenwekkende kop. Of modern kantoor. Geen saaie spreadsheet-stockfoto's.
- **Diensten-idee:** card-grid: administratie, jaarrekening, belastingaangifte, salarisadministratie, advies, ZZP-pakketten.
- **Content:** pakketten/tarieven, mkb/zzp-focus, digitaal boekhouden, team. Professioneel maar toegankelijk.
- **Typische elementen:** pakketten met prijzen, team, samenwerkingspartners (software), referenties, gratis kennismaking-CTA.`,
  },
  {
    id: "architect",
    label: "Architect / Ontwerpbureau",
    sections: ["hero", "features", "about", "gallery", "team", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: ARCHITECT / ONTWERPBUREAU**
Creativiteit, visie en ruimtelijk denken. De website IS het portfolio — elk project vertelt een verhaal.
- **Hero-idee:** prachtig architectuurproject als full-bleed foto. Of typografisch met minimalistisch design-statement.
- **Portfolio-idee:** spotlight per project met grote foto's, projectbeschrijving, locatie. Visueel dominant.
- **Content:** ontwerpfilosofie, werkproces, duurzaamheid, team. Inspirerend en visueel sterk.
- **Typische elementen:** projectenportfolio (DIT IS CRUCIAAL), ontwerpfilosofie, team, prijzen/onderscheidingen, contact.`,
  },
  {
    id: "consultant",
    label: "Consultant / Adviesbureau",
    sections: ["hero", "features", "about", "team", "testimonials", "faq", "footer"],
    heroStrategy: "typographic",
    servicesFormat: "card-grid",
    vibe: "corporate",
    promptHint: `**BRANCHE-INSPIRATIE: CONSULTANT / ADVIESBUREAU**
Expertise, resultaat en partnerschap. De website moet autoriteit uitstralen zonder arrogant te zijn.
- **Hero-idee:** typografisch met krachtig value-proposition. Zakelijk, confident.
- **Diensten-idee:** card-grid: strategie, organisatie, digitale transformatie, change management, interim-management.
- **Content:** aanpak/methodologie, cases/resultaten, team met expertise, thought leadership.
- **Typische elementen:** diensten, aanpak-visualisatie, case studies, team, contact/kennismaking-CTA.`,
  },
  {
    id: "marketing_agency",
    label: "Marketing- / Webbureau",
    sections: ["hero", "features", "about", "gallery", "team", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: MARKETING- / WEBBUREAU / MULTIMEDIA**
Creativiteit, resultaat en digitale expertise. De website is het visitekaartje — het MOET indruk maken.
- **Hero-idee (VERPLICHT visuele diepte):** **geen** kale zwarte of grijze vlakken. Voorkeur: **full-bleed Unsplash** (\`style="background-image:url(https://images.unsplash.com/photo-…?w=1920&q=80)"\` + \`bg-cover bg-center\`) — abstract digitaal, werkplek met schermen, bokeh, filmset, camera, stad bij nacht — passend bij multimedia/tech. **Of** een echte \`<video>\`-achtergrond **alleen** als de briefing een **concrete https-MP4/WebM-URL** bevat (eigen upload); **geen** stock-video zonder URL. **Subtiele variant** (rustig, niet druk): mag — zolang er **gelaagde gradient + textuur/decor** is (geen effen \`bg-black\`); foto hoeft niet altijd dominant.
- **Diensten-idee:** card-grid: webdesign, SEO, social media, branding, campagnes, content. Visueel en modern.
- **Content:** portfolio is koning — toon resultaten, niet alleen diensten. Cases met voor/na of cijfers.
- **Typische elementen:** portfolio/cases, diensten, werkproces, team, klant-logo's, contact/offerte-CTA.`,
  },
  {
    id: "insurance",
    label: "Verzekeringen / Financieel advies",
    sections: ["hero", "features", "about", "testimonials", "faq", "footer"],
    heroStrategy: "typographic",
    servicesFormat: "card-grid",
    vibe: "corporate",
    promptHint: `**BRANCHE-INSPIRATIE: VERZEKERINGEN / FINANCIEEL ADVIES**
Vertrouwen, zekerheid en onafhankelijk advies. De klant wil zich goed verzekerd weten.
- **Hero-idee:** typografisch met geruststellende boodschap. Geen generieke "gelukkig gezin"-stockfoto's.
- **Diensten-idee:** card-grid: particuliere verzekeringen, zakelijke verzekeringen, hypotheekadvies, pensioen.
- **Content:** onafhankelijk advies, vergelijken, persoonlijke benadering, keurmerken. Betrouwbaar.
- **Typische elementen:** verzekeringen-overzicht, keurmerken (WFt, Kifid), team, schademelden-CTA, gratis adviesgesprek.`,
  },

  // ── SPORT & LIFESTYLE ──────────────────────────────────────────────
  {
    id: "gym",
    label: "Sportschool / Gym",
    sections: ["hero", "features", "about", "gallery", "team", "footer"],
    compactLandingDefaultFaq: true,
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: SPORTSCHOOL / GYM**
Energie, kracht en motivatie. De website moet activeren — de bezoeker moet zin krijgen om te sporten.
- **Hero-idee:** atleet in actie in de gym, of krachtige apparatuur. Bold, energiek — **donkere sportschool** óf **heldere moderne gym** met veel licht; geen default naar zwart.
- **Aanbod-idee:** card-grid: fitness, groepslessen, personal training, sauna, abonnementen.
- **Content:** faciliteiten, openingstijden, abonnementsprijzen, proefles, trainers. Motiverend en transparant.
- **Typische elementen:** abonnementsprijzen, lesrooster, faciliteiten-tour, trainers-team, proefles-CTA.`,
  },
  {
    id: "personal_trainer",
    label: "Personal Trainer",
    sections: ["hero", "features", "about", "gallery", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: PERSONAL TRAINER**
Resultaat, motivatie en persoonlijke aandacht. De trainer IS het merk — de website verkoopt de persoon.
- **Hero-idee:** de trainer in actie, of een before/after transformatie. Krachtig, persoonlijk, authentiek.
- **Diensten-idee:** prijslijst: personal training 1-op-1, duo-training, online coaching, voedingsadvies, bootcamp.
- **Content:** de trainer als persoon (verhaal, certificeringen), resultaten van klanten, werkwijze/aanpak.
- **Typische elementen:** over de trainer (persoonlijk verhaal), pakketten/prijzen, transformatie-galerij, klantreviews, boekings-CTA.`,
  },
  {
    id: "yoga",
    label: "Yogastudio / Pilates",
    sections: ["hero", "features", "about", "team", "gallery", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: YOGASTUDIO / PILATES**
Rust, balans en welzijn. De website moet sereniteit uitstralen — de bezoeker moet al ontspannen bij het bekijken.
- **Hero-idee:** serene yogapose, of rustig studio-interieur met natuurlijk licht. Minimalistisch, kalm.
- **Lessen-idee:** card-grid: hatha yoga, vinyasa, yin yoga, pilates, meditatie, zwangerschapsyoga.
- **Content:** lesrooster, docenten met hun stijl, introductielessen, retreats, workshops. Rustgevende toon.
- **Typische elementen:** lesrooster, docenten-team, introductie-aanbod, workshops/retreats, online boeken.`,
  },
  {
    id: "dance_school",
    label: "Dansschool",
    sections: ["hero", "features", "about", "gallery", "team", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: DANSSCHOOL**
Beweging, expressie en plezier. De website moet de energie van dans overbrengen — dynamisch maar toegankelijk.
- **Hero-idee:** dansers in actie, of stijlvol dansstudio-interieur. Dynamisch, levendig.
- **Lessen-idee:** card-grid: salsa, bachata, streetdance, ballet, ballroom, kinderdans, trouwdans.
- **Content:** lesrooster, niveaus (beginners welkom!), docenten, workshops, feestjes/events.
- **Typische elementen:** dansstijlen-overzicht, lesrooster, proefles-CTA, docentenTeam, evenementen/workshops.`,
  },
  {
    id: "martial_arts",
    label: "Vechtsport / Martial Arts",
    sections: ["hero", "features", "about", "gallery", "team", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "industrial",
    promptHint: `**BRANCHE-INSPIRATIE: VECHTSPORT / MARTIAL ARTS**
Discipline, kracht en respect. De website moet krachtig zijn maar ook respectvol en uitnodigend voor beginners.
- **Hero-idee:** vechtsporter in actie, of dojo/gym — **donkere dramatische sfeer** óf **licht/open** zaal met natuurlijk licht. Krachtig, bold.
- **Lessen-idee:** card-grid: kickboxen, MMA, jiu-jitsu, karate, taekwondo, boksen, kids martial arts.
- **Content:** trainers met credentials, lesniveaus, proefles, competitie-resultaten, filosofie.
- **Typische elementen:** stijlen-overzicht, trainers, proefles-CTA, wedstrijdresultaten, kinderlessen.`,
  },

  // ── OVERIGE DIENSTEN ────────────────────────────────────────────────
  {
    id: "photographer",
    label: "Fotograaf / Videograaf",
    sections: ["hero", "gallery", "features", "about", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: FOTOGRAAF / VIDEOGRAAF**
Het werk IS de website. Elke foto moet spreken. Minimale tekst, maximale visuele impact.
- **Hero-idee:** full-bleed signature foto. De beste foto is de hero. Geen tekst nodig behalve naam + specialisatie.
- **Portfolio-idee:** galerij is CRUCIAAL — categorieën: bruiloften, portretten, zakelijk, events, producten.
- **Content:** over de fotograaf (persoonlijk verhaal), werkwijze, pakketten/prijzen. Laat het werk spreken.
- **Typische elementen:** portfolio-galerij (dit IS de site), over mij, pakketten/prijzen, booking-CTA, referenties.`,
  },
  {
    id: "tattoo",
    label: "Tattooshop",
    sections: ["hero", "gallery", "features", "about", "team", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "industrial",
    promptHint: `**BRANCHE-INSPIRATIE: TATTOOSHOP**
Kunst, expressie en vakmanschap. De website moet de stijl van de shop weerspiegelen — edgy maar professioneel.
- **Hero-idee:** close-up van tattoo-kunstwerk, of artiest aan het werk. Donker, artistiek, bold.
- **Portfolio-idee:** galerij per stijl: realistisch, blackwork, old school, fine line, kleur, geometric.
- **Content:** artiesten met hun specialisatie en portfolio, hygiëne-info, prijsindicatie, nazorg-tips.
- **Typische elementen:** portfolio per artiest, stijlen-overzicht, boekingsproces uitleg, nazorg-FAQ, contact/boekings-CTA.`,
  },
  {
    id: "driving_school",
    label: "Rijschool",
    sections: ["hero", "features", "about", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: RIJSCHOOL**
Vrijheid, vertrouwen en slagingspercentage. De leerling wil weten: hoe snel haal ik mijn rijbewijs?
- **Hero-idee:** lesauto op de weg, of trotse geslaagde leerling. Positief, toegankelijk.
- **Pakketten-idee:** card-grid: lespakketten (10/20/30 lessen), spoedcursus, theorie, motor, aanhanger. Prijzen prominent.
- **Content:** slagingspercentage, lespakketten met prijzen, instructeurs, lesgebied, CBR-info.
- **Typische elementen:** lespakketten + prijzen, slagingspercentage, gratis proefles-CTA, instructeurs, lesgebied.`,
  },
  {
    id: "cleaning",
    label: "Schoonmaakbedrijf",
    sections: ["hero", "features", "about", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: SCHOONMAAKBEDRIJF**
Betrouwbaarheid, grondigheid en gemak. De klant wil ontzorgd worden — schoon huis of kantoor zonder gedoe.
- **Hero-idee:** blinkend schoon interieur, of team aan het werk. Fris, licht, betrouwbaar.
- **Diensten-idee:** card-grid: huishoudelijk, zakelijk, verhuisschoonmaak, glazenwassen, vloeronderhoud.
- **Content:** werkgebied, tarieven/uurprijs, verzekerd, vaste teams, flexibel opzegbaar. Vertrouwenwekkend.
- **Typische elementen:** diensten, werkgebied, offerte-CTA, referenties, verzekering/keurmerk.`,
  },
  {
    id: "gardener",
    label: "Hoveniersbedrijf / Tuinman",
    sections: ["hero", "features", "about", "gallery", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: HOVENIERSBEDRIJF / TUINMAN**
Natuur, vakmanschap en een mooie buitenruimte. De website moet de schoonheid van tuinen tonen.
- **Hero-idee:** prachtig aangelegde tuin, of hovenier aan het werk. Groen, natuurlijk, seizoensfoto.
- **Diensten-idee:** card-grid: tuinontwerp, tuinaanleg, onderhoud, snoeiwerk, bestrating, vijveraanleg.
- **Content:** voor/na foto's, seizoenstips, werkgebied, offerte. Vakkundig en natuurlijk.
- **Typische elementen:** projecten-galerij (voor/na), diensten, werkgebied, offerte-CTA, seizoenstips.`,
  },
  {
    id: "plumber",
    label: "Loodgieter / Installateur",
    sections: ["hero", "features", "about", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: LOODGIETER / INSTALLATEUR**
Betrouwbaarheid, snelheid en vakmanschap. De klant heeft vaak een acuut probleem — de website moet direct vertrouwen geven.
- **Hero-idee:** vakman aan het werk, of modern badkamerinterieur. Professioneel, betrouwbaar.
- **Diensten-idee:** card-grid: lekkage, ontstopping, cv-ketel, badkamerrenovatie, vloerverwarming.
- **Content:** 24/7 spoedservice (indien van toepassing), werkgebied, tarieven, garantie, gecertificeerd.
- **Typische elementen:** SPOEDNUMMER prominent, diensten, werkgebied, tarieven, certificeringen, offerte-CTA.`,
  },
  {
    id: "painter",
    label: "Schildersbedrijf",
    sections: ["hero", "features", "about", "gallery", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: SCHILDERSBEDRIJF**
Vakmanschap, oog voor detail en een mooi resultaat. De website moet de kwaliteit van het werk tonen.
- **Hero-idee:** schilder aan het werk, of een net opgeleverd pand. Strak, professioneel.
- **Diensten-idee:** card-grid: binnen schilderwerk, buiten schilderwerk, behangen, houtrot-reparatie, kleuradvies.
- **Content:** voor/na foto's, werkgebied, garantie, vakkundig personeel. Betrouwbaar en vakkundig.
- **Typische elementen:** projecten-galerij (voor/na), diensten, werkgebied, offerte-CTA, garantie-info.`,
  },
  {
    id: "electrician",
    label: "Elektricien",
    sections: ["hero", "features", "about", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: ELEKTRICIEN**
Veiligheid, vakmanschap en betrouwbaarheid. Elektra is serieus — de website moet competentie uitstralen.
- **Hero-idee:** elektricien aan het werk, of moderne meterkast/verlichting. Professioneel, technisch.
- **Diensten-idee:** card-grid: aanleg, storing, uitbreiding, domotica, EV-laadpaal, zonnepanelen, keuring.
- **Content:** gecertificeerd (NEN), spoedservice, werkgebied, transparante tarieven.
- **Typische elementen:** STORINGSNUMMER, diensten, certificeringen (NEN 1010), werkgebied, offerte-CTA.`,
  },
  {
    id: "pet_care",
    label: "Hondenuitlaat / Dierenverzorging",
    sections: ["hero", "features", "about", "gallery", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: HONDENUITLAAT / DIERENVERZORGING**
Liefde, betrouwbaarheid en de beste zorg voor hun huisdier. Eigenaren zijn kieskeurig — de website moet vertrouwen geven.
- **Hero-idee:** blije honden op wandeling, of trimsalon in actie. Warm, vrolijk, betrouwbaar.
- **Diensten-idee:** card-grid: hondenuitlaatservice, dagopvang, oppas aan huis, trimmen, puppycursus.
- **Content:** kleine groepjes, verzekerd, persoonlijk contact, foto-updates, wandelgebied.
- **Typische elementen:** diensten + tarieven, wandelgebied/locatie, foto-galerij van de dieren, reviews, boekings-CTA.`,
  },
  {
    id: "vet",
    label: "Dierenarts / Dierenkliniek",
    sections: ["hero", "features", "about", "team", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: DIERENARTS / DIERENKLINIEK**
Zorg, expertise en empathie. Huisdiereigenaren zoeken de beste zorg voor hun dier — vertrouwen is alles.
- **Hero-idee:** dierenarts met dier, of moderne praktijk. Warm, professioneel, empathisch.
- **Diensten-idee:** card-grid: consult, vaccinaties, operaties, tandheelkunde, chip, echografie, euthanasie.
- **Content:** team met specialisaties, spoedservice, huisdier-soorten (hond, kat, konijn, etc.), preventie-advies.
- **Typische elementen:** SPOEDNUMMER, team, diensten, openingstijden, online afspraak, eerste bezoek-info.`,
  },

  // ── HOSPITALITY ─────────────────────────────────────────────────────
  {
    id: "hotel",
    label: "Hotel / B&B",
    sections: ["hero", "features", "gallery", "about", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: HOTEL / BED & BREAKFAST**
Comfort, sfeer en een onvergetelijk verblijf. De website verkoopt de ervaring, niet alleen de kamer.
- **Hero-idee:** prachtig kamerinterieur, of het hotel bij avondlicht. Aspirationeel, uitnodigend.
- **Kamers-idee:** spotlight per kamertype met grote foto, beschrijving, faciliteiten, prijs per nacht.
- **Content:** locatie-highlights, faciliteiten (ontbijt, wellness, parkeren), omgeving/activiteiten.
- **Typische elementen:** kamertypes, faciliteiten, locatie/omgeving, boekings-CTA (of link naar booking.com), galerij.`,
  },
  {
    id: "camping",
    label: "Camping / Glamping",
    sections: ["hero", "features", "gallery", "about", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: CAMPING / GLAMPING**
Natuur, vrijheid en ontspanning. De website moet het buitengevoel oproepen — groen, ruimte, avontuur.
- **Hero-idee:** kampeerders bij zonsondergang, of luxe glamping-tent in de natuur. Sfeervol, natuur.
- **Verblijf-idee:** card-grid: campingplaatsen, stacaravans, glamping-tenten, trekkershutten. Foto + prijs.
- **Content:** faciliteiten (sanitair, zwembad, speeltuin), omgeving, seizoensactiviteiten, huisdieren welkom?.
- **Typische elementen:** accommodatietypes, faciliteiten, plattegrond, omgeving/activiteiten, boekings-CTA.`,
  },
  {
    id: "wedding_venue",
    label: "Trouwlocatie / Evenementenlocatie",
    sections: ["hero", "features", "gallery", "about", "testimonials", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: TROUWLOCATIE / EVENEMENTENLOCATIE**
Dromen, romantiek en een perfecte dag. De website moet het gevoel oproepen van "hier wil ik trouwen".
- **Hero-idee:** prachtig gedekte zaal, of bruidspaar op de locatie. Romantisch, aspirationeel.
- **Zalen-idee:** spotlight per ruimte met foto's, capaciteit, mogelijkheden. Sfeervolle presentatie.
- **Content:** pakketten, catering, ceremonie + receptie + feest, eigen wensen, overnachting voor gasten.
- **Typische elementen:** locatie-galerij, pakketten, capaciteit, contact/bezichtiging-CTA, bruilofts-testimonials.`,
  },
  {
    id: "funeral",
    label: "Uitvaartonderneming",
    sections: ["hero", "features", "about", "team", "faq", "footer"],
    heroStrategy: "typographic",
    servicesFormat: "card-grid",
    vibe: "warm",
    promptHint: `**BRANCHE-INSPIRATIE: UITVAARTONDERNEMING**
Respect, waardigheid en steun in een moeilijke tijd. De website moet sereen, respectvol en troostend zijn.
- **Hero-idee:** typografisch — rustig, respectvol, geen foto's van verdriet. Serene achtergrond, empathische kop.
- **Diensten-idee:** card-grid: begrafenis, crematie, persoonlijk afscheid, rouwverwerking, uitvaartkosten.
- **Content:** 24/7 bereikbaarheid, werkwijze, persoonlijke begeleiding, transparante kosten. Empathisch, nooit commercieel.
- **Typische elementen:** 24/7 TELEFOONNUMMER prominent, werkwijze stap-voor-stap, diensten, over het team, kosten-transparantie.`,
  },

  // ── AUTO ────────────────────────────────────────────────────────────
  {
    id: "car_dealer",
    label: "Autodealer / Showroom",
    sections: ["hero", "shop", "features", "about", "brands", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "spotlight",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: AUTODEALER / SHOWROOM**
Luxe, prestatie en de droom van een nieuwe auto. De website is de digitale showroom.
- **Hero-idee:** premium auto in showroom of op sfeervolle locatie. Glanzend, aspirationeel.
- **Voorraad-idee:** spotlight-cards per auto met foto, merk, model, prijs, km-stand, bouwjaar. Of uitgelicht model full-bleed.
- **Content:** voorraad, financiering, inruil, garantie, onderhoud. Professioneel en transparant.
- **Typische elementen:** voorraad-overzicht, merken, financiering/lease-info, inruil-CTA, proefrit-CTA.`,
  },
  {
    id: "car_detailing",
    label: "Autopoets / Detailing",
    sections: ["hero", "features", "about", "gallery", "testimonials", "footer"],
    heroStrategy: "photo",
    servicesFormat: "price-list",
    vibe: "luxury",
    promptHint: `**BRANCHE-INSPIRATIE: AUTOPOETS / DETAILING**
Perfectie, glans en obsessie voor detail. De website moet de kwaliteit van het werk tonen — elke reflectie telt.
- **Hero-idee:** glanzende auto in close-up, of detailer aan het werk. Premium — **donkere studio** óf **witte cyclorama / heldere werkplaats**; reflectie en contrast zijn leidend, niet per se zwart.
- **Diensten-idee:** prijslijst per pakket: uitwendig, inwendig, compleet, ceramic coating, PPF, velgencoating.
- **Content:** voor/na foto's, premium producten, werkwijze, haal/breng-service.
- **Typische elementen:** pakketten + prijzen, voor/na galerij, premium merken (Gyeon, Gtechniq), boekings-CTA.`,
  },
  {
    id: "car_rental",
    label: "Autoverhuur",
    sections: ["hero", "features", "about", "gallery", "faq", "footer"],
    heroStrategy: "photo",
    servicesFormat: "card-grid",
    vibe: "modern",
    promptHint: `**BRANCHE-INSPIRATIE: AUTOVERHUUR**
Gemak, keuze en betrouwbaarheid. De klant wil snel de juiste auto vinden en boeken.
- **Hero-idee:** rij auto's op een rij, of premium auto op sfeervolle locatie. Clean, modern.
- **Wagenpark-idee:** card-grid per categorie: stadsauto, sedan, SUV, busje, luxe, elektrisch. Prijs per dag.
- **Content:** ophaallocaties, voorwaarden, verzekering, km-vrij, leeftijdseisen. Helder en praktisch.
- **Typische elementen:** wagenpark met dagprijzen, locaties, huurvoorwaarden, reserveer-CTA, zakelijke verhuur.`,
  },
];

export const INDUSTRY_KEYWORDS: { pattern: RegExp; profileId: string }[] = [
  {
    pattern:
      /\b(barber|barbershop|herenkapper|herenkapster|herensalon|heren\s*salon|baard\s*trim|hot\s*towel|fade|tondeuse|scheren|knipstoel|scheerstoel)\b/i,
    profileId: "barber",
  },
  { pattern: /\b(dameskapper|dameskapster|damessalon|dameskapsalon|vrouwenkapper|vrouwen\s*salon|vrouwen\s*kapsalon)\b/i, profileId: "womens_salon" },
  { pattern: /\b(kapper|kappers|kapsalon|haarsalon|hair\s*salon|hairstylist|haarverzorging|stylist|coiffeur|balayage|highlights|kleuring|föhn)\b/i, profileId: "hair_salon" },
  { pattern: /\b(elektronica|electronics|tv|laptop|telefoon|smartphone|headphone|koptelefoon|camera|drone|gadget|tech\s*winkel|tech\s*shop|audio|computer)\b/i, profileId: "retail_electronics" },
  { pattern: /\b(garage|autogarage|werkplaats|apk|auto\s*reparatie|monteur|autobedrijf|bandenwissel|airco\s*service|carrosserie)\b/i, profileId: "garage" },
  { pattern: /\b(transport|logistiek|vrachtwagen|koeriersdienst|bezorging|vrachtvervoer|expeditie|vloot|chauffeur|scheepvaart|shipping)\b/i, profileId: "transport" },
  { pattern: /\b(makelaar|makelaardij|vastgoed|real\s*estate|woningen|huizen|appartement|bezichtiging|waardebepaling|hypotheek|verhuur|huurwoning)\b/i, profileId: "realestate" },
  { pattern: /\b(restaurant|eetcafe|bistro|brasserie|horeca|chef|menu|keuken|reserveren|tafel|gerecht|culinair|trattoria|pizzeria)\b/i, profileId: "restaurant" },
  { pattern: /\b(schoonheidssalon|beautysalon|beauty|gezichtsbehandeling|manicure|pedicure|nagelsalon|huidverzorging|waxing|lash|wimper|permanent\s*make-?up)\b/i, profileId: "beauty" },
  { pattern: /\b(bouw|aannemer|constructie|renovatie|verbouwing|nieuwbouw|dakwerken|metselwerk|timmerman|stukadoor)\b/i, profileId: "construction" },

  // Mode & Kleding
  { pattern: /\b(herenkleding|herenmode|herenpakken|men'?s\s*fashion|maatpak|overhemd|herenkostuums)\b/i, profileId: "mens_fashion" },
  { pattern: /\b(dameskleding|damesmode|vrouwenkleding|vrouwenmode|women'?s\s*fashion|jurken|blouses|damesboutique)\b/i, profileId: "womens_fashion" },
  { pattern: /\b(babykleding|kinderkleding|baby|peuter\s*kleding|kids\s*fashion|kinderschoenen|baby\s*mode)\b/i, profileId: "kids_clothing" },
  { pattern: /\b(schoenenwinkel|schoenen|schoenenzaak|sneaker\s*shop|sneakers|schoenmaker)\b/i, profileId: "shoes" },
  { pattern: /\b(juwelier|sieraden|juwelen|goudsmid|trouwringen|verlovingsring|horloges|edelstenen|jewelry)\b/i, profileId: "jewelry" },

  // Winkels & Retail
  { pattern: /\b(bloemenwinkel|florist|bloemist|boeketten|bruidsboeket|bloemen|rouwstuk|bloemschikken)\b/i, profileId: "florist" },
  { pattern: /\b(interieur\s*winkel|meubelzaak|meubels|interieurdesign|woondecoratie|woonwinkel|design\s*meubel|inrichting|verlichting\s*winkel)\b/i, profileId: "interior" },
  { pattern: /\b(fietsenwinkel|fietsen\s*zaak|fietsenzaak|e-?bike|racefiets|fietsmaker|fietsenmaker|tweewieler)\b/i, profileId: "bike_shop" },
  { pattern: /\b(dierenwinkel|dierenspeciaalzaak|dierbenodigdheden|huisdierwinkel|pet\s*shop|diervoeding)\b/i, profileId: "pet_store" },
  { pattern: /\b(opticien|optiek|brillen\s*winkel|brillenwinkel|optometrist|contactlenzen|oogmeting|zonnebrillen)\b/i, profileId: "optician" },
  {
    pattern:
      /\b(hengelsport|viswinkel|visspeciaalzaak|hengel\s*zaak|hengelsportzaak|vlootwinkel|aaswinkel|visserij|karpervissen|spinhengel|vliegvissen|moulinet|hengel\s*&\s*molen|fishing\s*tackle|tackle\s*shop)\b/i,
    profileId: "angling_shop",
  },
  { pattern: /\b(sportwinkel|sportzaak|sportartikelen|sportkleding|outdoor\s*winkel|kampeerwinkel)\b/i, profileId: "sports_store" },
  { pattern: /\b(bakkerij|bakker|patisserie|broodbakker|banketbakker|taartenbakker|croissant|brood)\b/i, profileId: "bakery" },
  { pattern: /\b(slagerij|slager|traiteur|vleesspecialist|charcuterie|poelier)\b/i, profileId: "butcher" },
  { pattern: /\b(slijterij|slijter|wijnhandel|wijnwinkel|whisky\s*bar|drankwinkel|wijn\s*en\s*spijs|wijnspecialist)\b/i, profileId: "liquor_store" },
  { pattern: /\b(boekwinkel|boekhandel|boekenwinkel|boekenplank|bookshop|bookstor)\b/i, profileId: "bookstore" },

  // Eten & Drinken
  { pattern: /\b(café|cafe|koffiebar|koffiezaak|coffee\s*shop|espressobar|koffiehuis|lunchroom|lunchcafé)\b/i, profileId: "cafe" },
  { pattern: /\b(ijssalon|ijs\s*salon|ijswinkel|gelato|gelateria|ijs\s*en\s*sorbet|roomijs)\b/i, profileId: "ice_cream" },
  { pattern: /\b(foodtruck|food\s*truck|street\s*food|streetfood|mobiele\s*keuken)\b/i, profileId: "foodtruck" },
  { pattern: /\b(catering|cateraar|partyservice|feestcatering|bedrijfscatering|walking\s*dinner)\b/i, profileId: "catering" },

  // Gezondheid & Welzijn
  { pattern: /\b(tandarts|tandartsenpraktijk|mondhygiëne|mondhygienist|tandheelkunde|dentist|orthodontist)\b/i, profileId: "dentist" },
  { pattern: /\b(fysiotherapie|fysiotherapeut|fysio|manuele\s*therapie|sportfysio|revalidatie|oefentherapie|dry\s*needling)\b/i, profileId: "physiotherapy" },
  { pattern: /\b(psycholoog|psychologe|therapeut|therapie|psychotherapie|EMDR|GGZ|coach\s*ing|burn-?out|counseling)\b/i, profileId: "psychologist" },
  { pattern: /\b(huisarts|huisartsenpraktijk|gezondheidscentrum|medisch\s*centrum|kliniek|polikliniek|dokter|arts)\b/i, profileId: "medical" },
  { pattern: /\b(spa|wellness|sauna|hamam|thermen|massage\s*salon|relaxen|ontspanning|spa\s*resort)\b/i, profileId: "spa_wellness" },

  // Zakelijke diensten
  { pattern: /\b(advocaat|advocaten\s*kantoor|advocatenkantoor|jurist|juridisch|letselschade|rechts\s*hulp|strafrecht)\b/i, profileId: "lawyer" },
  { pattern: /\b(notaris|notariaat|notariskantoor|notarieel|koopakte|testament|huwelijksvoorwaarden)\b/i, profileId: "notary" },
  { pattern: /\b(accountant|boekhouder|boekhoudkantoor|administratiekantoor|jaarrekening|belastingaangifte|fiscalist|belastingadviseur)\b/i, profileId: "accountant" },
  { pattern: /\b(architect|architecten\s*bureau|architectenbureau|ontwerp\s*bureau|interieurarchitect|bouwkundig\s*ontwerp)\b/i, profileId: "architect" },
  { pattern: /\b(consultant|adviesbureau|advies\s*bureau|management\s*advies|organisatieadvies|strategie\s*advies)\b/i, profileId: "consultant" },
  {
    pattern:
      /\b(marketing\s*bureau|reclamebureau|webbureau|digital\s*agency|web\s*agency|branding\s*bureau|SEO\s*bureau|social\s*media\s*bureau|web\s*solutions|premium\s*web|multimedia|motion\s*graphics|videoproductie|video\s*productie|creatieve\s*studio|digital\s*studio|brand\s*experience|digital\s*experience|cinematic\s*canvas)\b/i,
    profileId: "marketing_agency",
  },
  { pattern: /\b(verzekering|verzekeringsadviseur|financieel\s*adviseur|hypotheekadviseur|assurantie|pensioenadviseur)\b/i, profileId: "insurance" },

  // Sport & Lifestyle
  { pattern: /\b(sportschool|gym|fitness\s*centrum|fitnesscentrum|fitness\s*club|health\s*club|crossfit\s*box)\b/i, profileId: "gym" },
  { pattern: /\b(personal\s*trainer|personal\s*training|PT|privétrainer|privé\s*training)\b/i, profileId: "personal_trainer" },
  { pattern: /\b(yogastudio|yoga|pilates|meditatie\s*studio|mindfulness\s*studio|yin\s*yoga|vinyasa)\b/i, profileId: "yoga" },
  { pattern: /\b(dansschool|dans\s*studio|dansstudio|salsa|bachata|ballet\s*school|balletschool|streetdance|ballroom)\b/i, profileId: "dance_school" },
  { pattern: /\b(vechtsport|martial\s*arts|kickboks|kickboxen|MMA|jiu[\s-]?jitsu|karateschool|karate|taekwondo|boksschool|boksen)\b/i, profileId: "martial_arts" },

  // Overige diensten
  { pattern: /\b(fotograaf|fotografie|fotostudio|bruidsfotograaf|portretfotograaf|videograaf|videografie|trouwfotograaf)\b/i, profileId: "photographer" },
  { pattern: /\b(tattoo\s*shop|tattooshop|tattoo\s*studio|tatoeage|tatoeëerder|tattoo\s*artist|piercing\s*studio)\b/i, profileId: "tattoo" },
  { pattern: /\b(rijschool|rijles|autorijschool|rijbewijs|rijinstructeur|CBR|motorrijles)\b/i, profileId: "driving_school" },
  { pattern: /\b(schoonmaak\s*bedrijf|schoonmaakbedrijf|schoonmaak\s*dienst|glazenwasser|kantoorschoonmaak)\b/i, profileId: "cleaning" },
  { pattern: /\b(hovenier|hoveniersbedrijf|tuinman|tuinaanleg|tuinonderhoud|tuinarchitect|tuinontwerp|groenvoorziening)\b/i, profileId: "gardener" },
  { pattern: /\b(loodgieter|loodgietersbedrijf|installateur|installatiebedrijf|cv[\s-]?ketel|sanitair|rioleringswerk)\b/i, profileId: "plumber" },
  { pattern: /\b(schildersbedrijf|schilder|schilders|huisschilder|binnenschilderwerk|buitenschilderwerk|behanger)\b/i, profileId: "painter" },
  { pattern: /\b(elektricien|elektriciën|elektra\s*bedrijf|elektrotechniek|laadpaal|domotica|zonnepanelen\s*installatie)\b/i, profileId: "electrician" },
  { pattern: /\b(hondenuitlaat|honden\s*uitlaat|dierenverzorging|dier\s*oppas|kattenoppas|huisdieroppas|trimsalon|hondentrimsalon|dogwalker)\b/i, profileId: "pet_care" },
  { pattern: /\b(dierenarts|dierenkliniek|dierenartspraktijk|veterinair|dierenziekenhuis|dierendokter)\b/i, profileId: "vet" },

  // Hospitality
  { pattern: /\b(hotel|B&B|bed\s*(?:en|and|&)\s*breakfast|pension|gasthuis|boutique\s*hotel)\b/i, profileId: "hotel" },
  { pattern: /\b(camping|glamping|kamperen|stacaravan|trekkershut|bungalow\s*park|vakantie\s*park)\b/i, profileId: "camping" },
  { pattern: /\b(trouwlocatie|trouwzaal|feestlocatie|evenementenlocatie|partylocatie|bruiloft\s*locatie|congreslocatie)\b/i, profileId: "wedding_venue" },
  { pattern: /\b(uitvaart|uitvaartonderneming|begrafenis\s*ondernemer|begrafenisondernemer|crematie|rouwcentrum|rouw\s*begeleiding)\b/i, profileId: "funeral" },

  // Auto
  { pattern: /\b(autodealer|autobedrijf|auto\s*showroom|autoshowroom|occasions|auto\s*verkoop|dealer)\b/i, profileId: "car_dealer" },
  { pattern: /\b(autopoets|auto\s*detailing|autodetailing|car\s*detailing|carwash|ceramic\s*coating|PPF|lakbescherming|autowas)\b/i, profileId: "car_detailing" },
  { pattern: /\b(autoverhuur|auto\s*verhuur|car\s*rental|huurauto|auto\s*huren|wagenpark\s*verhuur)\b/i, profileId: "car_rental" },
];

/**
 * Branche-profielen waar de studio een canonieke `shop`-sectie (server-side inject) verwacht —
 * zelfde set als waar de generator webshop-nav/placeholders mag tonen.
 */
export function industryProfileIncludesCanonicalShopSection(
  profileId: string | null | undefined,
): boolean {
  const id = profileId?.trim();
  if (!id) return false;
  const p = INDUSTRY_PROFILES.find((x) => x.id === id);
  return p ? p.sections.includes("shop") : false;
}

/** Losse briefing-tekst: duidelijke webshop/e-commerce signalen (niet het brede woord “winkel” alleen). */
export const BRIEFING_EXPLICIT_WEBSHOP_SIGNAL = /\b(webshop|webwinkel|e-?commerce|winkelwagen|winkelmand|(?:online|in\s+de\s+webshop)\s+bestellen)\b/i;
