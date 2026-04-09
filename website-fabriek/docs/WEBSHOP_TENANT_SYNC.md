# Webshop: studio-slug ↔ Chameleon-tenant

## Probleem

- **Website Fabriek** gebruikt `clients.subfolder_slug` (marketing-URL’s, `/winkel/{slug}`, placeholders).
- **Chameleon** gebruikt `clients.slug` voor de publieke storefront (`/shop/c/{slug}`) en koppelt producten via `client_id`.

Zonder koppeling bestaat er **geen** automatische 1:1-relatie: je kunt in de studio webshop aanzetten terwijl Chameleon geen rij (of de verkeerde slug) heeft.

## Oplossing in deze repo

1. **Supabase-credentials** (server-only, in `.env.local` naast `package.json`):

   **Één project voor studio + boeking + webshop + CRM (meestal jouw situatie)**  
   Gebruik dezelfde waarden als de rest van website-fabriek al heeft:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

   Je hoeft **geen** `KAMELEON_*` in te vullen: de shop-sync valt dan automatisch terug op dit project.

   **Alleen nodig als de webshop echt op een ander Supabase-project staat:**

   - `KAMELEON_SUPABASE_URL` (alias: `CHAMELEON_SUPABASE_URL`)
   - `KAMELEON_SUPABASE_SERVICE_ROLE_KEY` (alias: `CHAMELEON_SUPABASE_SERVICE_ROLE_KEY`)

2. **Automatische sync**

   - **Nieuwe studio-klant** (`POST /api/clients`): upsert in Chameleon `clients` met `slug = subfolder_slug`, `webshop_enabled = false` (slug is “gereserveerd”, publieke shop blijft dicht tot je de switch aanzet).
   - **Webshop-switch in admin** (`PATCH .../commercial` met `webshop_enabled`): zelfde upsert met de nieuwe boolean (meestal `true`).

   Response-body kan `kameleon_shop_sync` bevatten:

   - `{ ok: true, skipped: true, reason: "..." }` — geen bruikbare service-role + URL (studio werkt normaal).
   - `{ ok: true, upserted: true }` — gelukt.
   - `{ ok: false, error: "..." }` — Chameleon-upsert mislukt (studio-update is wél doorgegaan); controleer keys, RLS, of migraties.

3. **Iframe op de studio-site**

   Zet in `.env.local`:

   ```env
   NEXT_PUBLIC_WEBSHOP_IFRAME_SRC_TEMPLATE=https://jouw-chameleon-host/shop/c/{slug}
   ```

   `{slug}` wordt vervangen door `subfolder_slug`. Die moet **exact** gelijk zijn aan Chameleon `clients.slug` (dat regelt de sync hierboven).

## Checklist (productie)

- [ ] Op **jouw** Supabase: tabellen/kolommen zodat zowel studio als Chameleon werken (vaak één `clients`-rij met o.a. `subfolder_slug`, `slug` gelijk eraan, en shopkolommen zoals in de Chameleon-migraties).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` staan op de server waar **website-fabriek** draait (voldoet voor één gedeeld project).
- [ ] Alleen bij **twee** Supabase-projecten: óók `KAMELEON_*` invullen.
- [ ] Chameleon-app gedeployed; iframe-template wijst naar die origin.
- [ ] Nieuwe klant aanmaken in studio → response controleren op `kameleon_shop_sync` (geen `ok: false`).
- [ ] Webshop aanzetten in commercial admin → opnieuw controleren.
- [ ] In browser: studio ` /winkel/{subfolder_slug}` + ingelogd/ingesteld zoals je portaal vereist; iframe laadt `/shop/c/{zelfde slug}`.

## Eén database voor alles?

**Ja, dat kan en is gebruikelijk:** boeking, CRM/studio en webshop praten met **dezelfde** Supabase. De sync gebruikt dan gewoon `SUPABASE_SERVICE_ROLE_KEY` (geen aparte `KAMELEON_*` nodig).

Let op: de **SQL-migraties** in deze repo beschrijven studio en Chameleon ooit als twee losse `clients`-ontwerpen. In de praktijk voeg je kolommen samen tot **één** `clients`-tabel (o.a. `subfolder_slug` voor de site, `slug` voor `/shop/c/…` — idealiter dezelfde waarde) plus shopvelden. Als je alleen studio-migraties hebt gedraaid en nog geen `slug` / `shop_name` / enz., faalt de upsert tot je die kolommen toevoegt (Chameleon-migraties of handmatige `ALTER TABLE`).
