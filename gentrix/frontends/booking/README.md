# GENTRIX — Boeking (booking app)

Vite + React boekingsflow en dashboard. Pad: `gentrix/frontends/booking` (eigen `package.json`; geen npm-workspace met de root).

## Live boeken (Gentrix API)

1. Start de Next-app in de repo-root: `npm run dev` (poort **3000**).
2. Start deze app: `npm run dev` (standaard **8080**). Vite proxy’t `/api` naar `127.0.0.1:3000`.
3. Open `http://localhost:8080/`, vul een studio-**slug** in, of ga direct naar **`/book/mosham`** (voorbeeld).

Zelfde contract als `gentrix.nl/boek/…` — zie `docs/BOOKING_GENTRIX_UNIFIED.md`. Optioneel: deploy de SPA elders en zet `VITE_GENTRIX_API_BASE` + CORS op Next (`BOOKING_VITE_PUBLIC_ORIGINS`). Optioneel: in Next `NEXT_PUBLIC_BOOKING_VITE_APP_URL` zodat `/boek/{slug}` redirect naar deze app.

**Mock-demo** (lokale JSON, geen API): `/demo`.

## Database

SQL voor het **standalone** datamodel van deze app staat in **`database/`** (volgorde `001_` … `010_`, zie `database/README.md`). Dat hoort bij de **mock**-flow; live boeken gebruikt **geen** tabellen uit `database/` maar het unified schema via de Next-API.
