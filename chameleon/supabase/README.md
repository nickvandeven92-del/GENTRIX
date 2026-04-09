# Supabase (Kameleon webshop)

## Mapstructuur

```
supabase/
├── README.md                 ← deze uitleg
├── config.toml               ← CLI-config (lokaal + link naar cloud)
├── seed.sql                  ← optionele startdata (na migraties)
└── migrations/               ← alleen .sql met tijdstempel-prefix
    ├── 20260210120010_kameleon_01_enums_tables_indexes.sql
    ├── 20260210120020_kameleon_02_rls_rpc_triggers.sql
    └── 20260210120030_kameleon_03_client_admin.sql
```

**Volgorde:** altijd `01` → `02` → `03`. Nummer in de bestandsnaam zorgt dat de CLI (en jij) de juiste volgorde aanhoudt.

---

## Shop, dashboard en CRM: hoe migraties “samenwerken”

De **Supabase CLI kijkt alleen naar `supabase/migrations/`**. Die map is **niet** gekoppeld aan je frontend-mappen (`src/shop`, `src/dashboard`, `src/crm`). Drie app-mappen = drie plekken voor **React-code**; **één plek** voor **alle** database-wijzigingen.

### Regels

1. **Alle migraties blijven in** `supabase/migrations/` — nooit drie aparte `migrations`-mappen voor de CLI (die worden niet samengevoegd).
2. **Volgorde = bestandsnaam.** Postgres sorteert op `YYYYMMDDHHMMSS` aan het begin. Wat **eerst** moet draaien (bijv. gedeelde `clients` of enums), krijgt een **lager** tijdstempel.
3. **Naamgeving met module**, zodat je in Git overzicht houdt:
   - `20260215100000_shop_nieuwe_index.sql`
   - `20260215103000_crm_sales_pipeline.sql`
   - `20260215104500_booking_slots.sql`
4. **Afhankelijkheden:** als CRM een FK naar `public.clients` (webshop) nodig heeft, moet de CRM-migratie een **later** tijdstempel hebben dan de migratie waar `clients` wordt aangemaakt.
5. **Optioneel strakker:** gebruik Postgres-**schemas** (`crm`, `bookings`, …) en zet dat in de migratie (`CREATE SCHEMA crm`). Dan blijven tabellen logisch gescheiden in één database; de webshop kan in `public` blijven of ook `shop` heten.

### Dashboard

“Dashboard” is meestal **geen eigen schema**: het is UI op dezelfde tabellen (producten, orders, …). Extra migraties voor dashboard = zeldzaam; als iets DB-nodig heeft (bijv. views voor rapporten), zelfde map + tijdstempel + tag `analytics_` of `reporting_`.

### Samenvatting

| In je repo | Rol |
|------------|-----|
| `src/shop`, `src/dashboard`, `src/crm` | Alleen applicatiecode |
| `supabase/migrations/*.sql` | **Alle** DB-wijzigingen, door elkaar, gesorteerd op tijdstempel |
| `supabase db push` | Voert alles wat nog niet gedraaid is, **in volgorde van de bestandsnamen**, uit |

---

## Aanbevolen: Supabase CLI (dit *is* de bedoeling)

De bedoeling van Supabase is dat **migraties in Git** staan en je ze met de **CLI** naar je project pusht. Dan heb je:

- dezelfde stappen op dev / staging / productie
- geschiedenis in het dashboard onder **Database → Migrations**

### Eenmalig

1. Installeer de CLI: [Supabase CLI](https://supabase.com/docs/guides/cli) (of: `npm i -g supabase` / `npx supabase`).
2. Login: `supabase login`
3. Koppel je cloudproject vanuit de projectmap (`chameleon`):

   ```bash
   supabase link --project-ref <PROJECT_REF>
   ```

   `PROJECT_REF` staat in het Supabase-dashboard onder **Project Settings → General → Reference ID**.

### Schema bijwerken

```bash
supabase db push
```

Dit voert alle **nieuwe** bestanden in `migrations/` uit op je gekoppelde database (niet handmatig knippen/plakken).

### Optioneel: seed

```bash
supabase db reset   # lokaal: reset + migraties + seed
```

Op **alleen cloud** kun je na `db push` de inhoud van `seed.sql` **één keer** in de SQL Editor uitvoeren, of een seed-flow inrichten zoals in de Supabase-docs.

---

## Mag het ook via de SQL Editor?

**Ja, dat kan**, vooral voor een eerste install of als je (nog) geen CLI gebruikt:

1. Open achtereenvolgens de drie bestanden in `migrations/`.
2. Plak de **volledige** inhoud in **SQL Editor** en run (01, dan 02, dan 03).

**Nadeel:** het Supabase-dashboard weet dan niet automatisch dat dit “migratie X” was; bij team of meerdere omgevingen raakt dat snel onduidelijk. **Bron van waarheid** blijft deze map in je repo; de Editor is dan een handmatige spiegel.

**Tip:** nieuwe wijzigingen het liefst als **nieuw** bestand in `migrations/` met een nieuw tijdstempel, daarna `db push` of opnieuw handmatig in volgorde runnen.

---

## Schone install (bestaande tabellen weg)

Als je eerder deels hebt gedraaid en errors kreeg (`relation already exists`), eerst opruimen **alleen als je die data niet nodig hebt** — zie hiervoor een `DROP` script in team-docs of vraag om een veilig reset-plan voor productie.

---

## Nieuwe migratie toevoegen

1. Nieuw bestand: `supabase/migrations/YYYYMMDDHHMMSS_korte_omschrijving.sql`
2. Commit in Git.
3. `supabase db push` (of handmatig die ene file runnen in de Editor).
