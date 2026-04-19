import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  /** Ingebouwd in Next `public/booking-app` — canoniek `/booking-app/book/{slug}` (geen aparte deploy-URL). */
  base: "/booking-app/",
  build: {
    outDir: path.resolve(__dirname, "../../public/booking-app"),
    emptyOutDir: true,
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    /** Proxy naar Gentrix Next (localhost:3000): `/api` → live boek-API zonder CORS. */
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "GENTRIX — Boekingen",
        short_name: "Boekingen",
        description: "Agenda en boekingen-dashboard voor je zaak. Los van het Gentrix-klantportaal.",
        theme_color: "#0d9488",
        background_color: "#fafafa",
        display: "standalone",
        lang: "nl",
        start_url: "/booking-app/dashboard",
        scope: "/booking-app/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/booking-app/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
