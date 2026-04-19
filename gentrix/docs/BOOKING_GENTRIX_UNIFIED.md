# Boekingen: één model voor alle klanten (GENTRIX)

Alle studio-klanten draaien op **hetzelfde** Postgres-schema onder `supabase/migrations/`. Eén rij in **`clients`** (met `subfolder_slug`) is één klant; afspraken, team en diensten hangen aan **`client_id`**.

## Wat is leidend?

| Onderdeel | Tabellen / kolommen |
| --- | --- |
| Klant (tenant) | `public.clients` (+ o.a. `appointments_enabled`, `booking_settings` jsonb) |
| Afspraken | `public.client_appointments` (`starts_at` / `ends_at` timestamptz, `staff_id`, `booking_service_id`, boeker-velden, `status`) |
| Medewerkers | `public.client_staff` + `public.client_staff_shifts` (roosterblokken) |
| Diensten | `public.client_booking_services` |
| API’s | Next: `/api/portal/...`, `/api/public/clients/.../booking-*` |

Nieuwe omgevingen: **alleen** migraties in **`gentrix/supabase/migrations/`** toepassen (CLI/SQL Editor volgens jullie gebruikelijke flow).

## Standalone zip (`frontends/booking/database/`)

Dat pakket hoort bij de **Vite-demo** (`businesses`, `services`, `employees`, …). **Niet** op hetzelfde productieproject naast bovenstaande tabellen zetten zonder migratieplan — dan heb je twee parallelle waarheden.

Gebruik die SQL hooguit op een **leeg** dev-project, of als referentie bij het porten van UI.

## Gap (demo-schema ↔ GENTRIX)

| Concept standalone | In GENTRIX |
| --- | --- |
| `businesses` + `slug` | `clients` + `subfolder_slug` (en overige marketingvelden) |
| `services` + `price` (decimal) | `client_booking_services` + `price_cents` |
| `service_categories` | *Geen aparte tabel*; desnoods categorie in `description` of later uitbreiden |
| `employees.serviceIds` + `service_employees` | *Geen junction-tabel*; koppeling medewerker↔dienst gebeurt in **applicatielogica** (publieke boekflow) |
| `employees.schedule` / `breaks` / `days_off` (JSONB) | **Shifts:** `client_staff_shifts` (timestamptz-blokken), geen 1:1 JSON-kopie op `client_staff` |
| `appointments`: DATE + TIME, enum status | `client_appointments`: timestamptz, `status` (o.a. `scheduled` / `cancelled`; uitbreidingen via migraties indien nodig) |
| `settings.openingHours` op business | `clients.booking_settings` (Zod: `week`, `slotDurationMinutes`, … — zie `lib/booking/booking-settings.ts`) |

## Vite booking-app (`frontends/booking/`, live)

- Route **`/book/{slug}`** in de SPA praat met dezelfde endpoints als `/boek/{slug}` in Next: `GET/POST /api/public/clients/{slug}/booking-*` en `…/appointments`.
- **Lokaal:** Next op `:3000`, Vite op `:8080`; Vite proxy’t `/api` naar Next (geen CORS).
- **Productie:** Vite-deploy op eigen URL → zet `VITE_GENTRIX_API_BASE=https://www.jouw-gentrix.nl` in de Vite-build en op Next **`BOOKING_VITE_PUBLIC_ORIGINS`** (of `NEXT_PUBLIC_BOOKING_VITE_ORIGINS`) op de exacte SPA-`Origin`(s).
- **Optioneel:** `NEXT_PUBLIC_BOOKING_VITE_APP_URL` in Next laat `/boek/{slug}` **redirecten** naar de Vite-app (`…/book/{slug}`).

## Praktische checklist

1. **Productie / staging:** alleen `supabase/migrations/`; geen `frontends/booking/database/*.sql` op datzelfde project.
2. **Per klant:** `appointments_enabled` aan; `booking_settings` en team/diensten vullen via portaal (of admin).
3. **Vite-app:** mock-demo blijft op **`/demo`**; live boeking op **`/book/{slug}`** — één schema via de Next-API’s hierboven.
