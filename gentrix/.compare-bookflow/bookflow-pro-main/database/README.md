# Database Migrations

SQL-migraties voor het afsprakensysteem. Geschikt voor PostgreSQL (incl. Supabase).

## Structuur

| Bestand | Inhoud |
|---|---|
| `001_extensions.sql` | UUID extensie |
| `002_businesses.sql` | Bedrijven + settings (JSONB voor openingstijden) |
| `003_service_categories.sql` | Categorieën van diensten |
| `004_services.sql` | Diensten (knippen, coaching, etc.) |
| `005_employees.sql` | Medewerkers + schedule/breaks/daysOff (JSONB) |
| `006_service_employees.sql` | Many-to-many koppeling diensten ↔ medewerkers |
| `007_appointments.sql` | Afspraken inclusief klantgegevens |
| `008_indexes.sql` | Extra indexen voor performance |
| `009_seed.sql` | Voorbeelddata (Studio Knipt + Mindset Coaching) |

## Uitvoeren

### Lokaal (psql)
```bash
psql "$DATABASE_URL" -f database/001_extensions.sql
psql "$DATABASE_URL" -f database/002_businesses.sql
# ...etc, in volgorde
```

Of in één keer:
```bash
for f in database/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

### Supabase
Plak elk bestand in volgorde in de SQL Editor en voer uit. Of gebruik de Supabase CLI:
```bash
supabase db push
```

## Datatypes

- **JSONB** wordt gebruikt voor `settings.openingHours`, `employees.schedule`, `employees.breaks`, `employees.days_off` omdat dit geneste, flexibele structuren zijn die 1-op-1 mappen op de TypeScript types.
- **Tijden** (`start_time`, `end_time`) zijn `TIME` zonder timezone — uren binnen een werkdag.
- **Datum** (`date`, `start_date`, `end_date`) is `DATE`.
- **Klantgegevens** zijn ingebed in `appointments` (geen aparte `customers` tabel) — pas dit aan als je terugkerende klanten wilt tracken.

## RLS

Per-tabel RLS is uitgeschakeld in deze migraties. Voeg policies toe wanneer je auth koppelt — zie `010_rls_example.sql` voor een voorbeeld dat je kunt activeren.
