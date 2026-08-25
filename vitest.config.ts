import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/lib/persistence/testing/**/*.test.ts", "node_modules/**"],
    coverage: { reporter: ["text", "html"] },
  },
});
