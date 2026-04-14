# GENTRIX

Next.js-studio (sites, admin, portaal) op de **projectroot**. Daarnaast staan losse **Vite + React**-apps voor de webshop (**chameleon**) en boeking (**booking**).

## Mappenstructuur (kort)

| Pad | Rol |
| --- | --- |
| `app/` | Next.js **App Router** (routes, layouts, API waar van toepassing). |
| `frontends/chameleon/`, `frontends/booking/` | Aparte Vite-SPA’s met **eigen** `package.json` en `npm install` in die map. Niet verwarren met `app/`. |
| `components/`, `hooks/`, `lib/`, `types/` | Gedeelde code voor de **Next.js-app**. |
| `supabase/` | Migraties en backend-config. |
| `remotion/` | Remotion-video’s; scripts in root-`package.json` (`remotion:studio`, enz.). |
| `scripts/` | Hulp-scripts (DB, PWA-iconen, …). |

De root is **geen** npm-workspaces-monorepo: alleen de hoofdapp gebruikt `npm install` in deze map. Voor Chameleon of Booking: naar `frontends/<naam>/` gaan en daar installeren en `npm run dev`.

## Getting Started (studio)

```bash
cd gentrix   # of open deze map als projectroot in je editor
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Getting Started (Vite-frontends)

```bash
cd frontends/booking    # of frontends/chameleon
npm install
npm run dev
```

Poort en URL staan in de terminal-output van Vite (meestal anders dan `:3000`).

## Meer

- [Next.js-documentatie](https://nextjs.org/docs)
- Deploy: o.a. [Vercel](https://vercel.com/docs) voor de Next-app; Vite-apps naar eigen hosting/build per project.
