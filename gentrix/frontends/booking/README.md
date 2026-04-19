# GENTRIX — Boeking (booking app)

Vite + React boekingsflow en dashboard. Pad: `gentrix/frontends/booking` (eigen `package.json`; geen npm-workspace met de root).

## Database

SQL voor het **standalone** datamodel van deze app staat in **`database/`** (volgorde `001_` … `010_`, zie `database/README.md`). Dat hoort bij deze frontend; de Next.js-studio gebruikt aparte migraties onder `gentrix/supabase/migrations/`.
