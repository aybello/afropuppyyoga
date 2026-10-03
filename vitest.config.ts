import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Credential checks make live API calls and belong in the explicit
    // integration gate, not in deterministic PR validation.
    exclude: [
      "server/anthropic.test.ts",
      "server/cancellation.test.ts",
      "server/luma.proxy.test.ts",
      "server/metaCapi.credentials.test.ts",
      "server/stripe.test.ts",
    ],
  },
});
