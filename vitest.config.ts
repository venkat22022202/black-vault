import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Only run BlackVault's own tests — the vendored infisical/ tree has its own suite.
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "infisical/**", ".next/**"],
  },
});
