# GENTRIX — Boeking (booking app)

Vite + React boekingsflow en dashboard. Pad: `gentrix/frontends/booking` (eigen `package.json`; geen npm-workspace met de root).

## Live boeken (Gentrix API)

**Ingebouwd in Next (productie):** vanaf de projectroot `npm run build` bouwt automatisch deze SPA naar `public/booking-app/`. Gebruikers gaan naar **`/boek/{slug}`** → redirect naar **`/booking-app/book/{slug}`**.

**Alleen Vite dev (UI):**

1. Next: `npm run dev` in repo-root (poort **3000**).
2. Deze map: `npm run dev` (poort **8080**). Proxy: `/api` → `127.0.0.1:3000`. SPA-URL: **`http://localhost:8080/booking-app/`** (base `/booking-app/`).

Zie `docs/BOOKING_GENTRIX_UNIFIED.md`. Zeldzaam: SPA op ander domein → `VITE_GENTRIX_API_BASE` + CORS (`BOOKING_VITE_PUBLIC_ORIGINS`).

**Mock-demo:** `/booking-app/demo` (onder Vite-dev) of na build op hetzelfde pad op je Next-domein.

## Database

SQL voor het **standalone** datamodel van deze app staat in **`database/`** (volgorde `001_` … `010_`, zie `database/README.md`). Dat hoort bij de **mock**-flow; live boeken gebruikt **geen** tabellen uit `database/` maar het unified schema via de Next-API.
