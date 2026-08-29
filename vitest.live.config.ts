import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: [
      "server/anthropic.test.ts",
      "server/cancellation.test.ts",
      "server/luma.proxy.test.ts",
      "server/metaCapi.credentials.test.ts",
      "server/stripe.test.ts",
    ],
    exclude: [],
  },
}));
