import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "features/design/production-dashboard.integration.test.ts",
    ],
  },
});
