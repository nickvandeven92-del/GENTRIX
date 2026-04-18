import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    /** Gescheurde / legacy imports; actieve app-tests zitten buiten `lib/ai/_archive/`. */
    exclude: ["lib/ai/_archive/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
