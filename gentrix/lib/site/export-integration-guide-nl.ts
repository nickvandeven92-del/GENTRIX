/**
 * Meegelverd met FTP-ZIP. Geen vervanging voor een volledige app-generator:
 * deze export blijft statische HTML/CSS/JS; backend hoort in een apart (mini-)project.
 */
export const EXPORT_INTEGRATION_GUIDE_NL = `Studio-export: backend & A/B-testen (realistische vervolgstappen)
================================================================

Wat zit er wél in deze ZIP?
---------------------------
- Statische site: index.html + styles.css (+ images). Geen Next.js-server, geen Prisma,
  geen ingebouwde /api-routes. Formulieren in de markup zijn dus niet “magisch” gekoppeld
  aan een database tot jij dat zelf bouwt.

Waarom geen “één klik = volledige Next.js + Supabase + auth-ZIP”?
-----------------------------------------------------------------
Dat is een apart product (secrets, migraties, upgrades, support). De Studio exporteert
bewust een lichte bundle voor hosting overal.

Aanbevolen: start vanaf een onderhouden GitHub-template
-------------------------------------------------------
Beter dan een door AI gegenereerde project-ZIP:
- **Template repository** op GitHub (bv. officiële Supabase + Next.js starters, of een
  door de community bijgehouden “next-supabase” template): vaste structuur, issues/PR’s,
  dependency-updates via npm/git — geen “unieke snowflake” per generatie.
- Gebruik **“Use this template”** / fork, zet \`NEXT_PUBLIC_SUPABASE_URL\` en secrets in
  Vercel, Netlify of je host — niet in deze statische export.
- Landingspagina uit deze ZIP host je **naast** of **onder** die app (zelfde domein via
  reverse proxy, submap, of subdomein), en laat formulieren naar **jouw** API-routes
  uit het template wijzen (fetch / form action).

Daarna: backend koppelen waar jij wilt — Vercel, Netlify Functions, VPS, Supabase Edge
Functions, Firebase, enz.

Supabase (praktisch patroon, vaak al in zo’n template)
------------------------------------------------------
1. Maak een project op https://supabase.com — bewaar service_role en anon keys **alleen**
   in server-side omgevingen (nooit in deze statische ZIP of in zichtbare custom JS).
2. Nieuwsbrief / leads: **Route Handler** of Edge Function die met service_role insert doet
   (tabel bv. subscribers) — veel templates hebben dit patroon al bijna klaar.
3. Contact: idem, of transactional mail (Resend, SendGrid) vanuit dezelfde serverless code.
4. Auth voor bezoekers: meestal al ingeregeld in het template; niet “1 regel in index.html”.

Firebase
--------
- Hosting voor dezelfde statische bestanden; **Cloud Functions** of **Callable** voor
  subscribe/contact. Zelfde regel: geen admin SDK-keys in de browser.

A/B-testen en conversies
------------------------
Er zit geen ingebouwde ABTestManager in deze export. Praktische opties:
- **Plausible** of vergelijkbaar (privacy-vriendelijke analytics, indien gewenst).
- **VWO**, **Optimizely**, of vergelijkbare tools voor traffic-split + metrics.
- Zelf bouwen: twee varianten hosten + edge middleware of load balancer — veel werk;
  meestal is SaaS sneller.

Formulieren in je HTML aanpassen
--------------------------------
Zet form action op de URL van jouw serverless endpoint, of gebruik fetch() in custom JS
(HTML-editor) naar jouw domein — met CORS correct ingesteld op die backend.

Verder lezen
------------
- Supabase (Next.js): https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Firebase Hosting: https://firebase.google.com/docs/hosting
`;
