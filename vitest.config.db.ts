import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/lib/persistence/**/*.test.ts"],
    coverage: { reporter: ["text", "html"] },
    env: {
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        "postgresql://postgres:password@127.0.0.1:5433/projectsetu_test",
    },
    // Database integration tests may take longer
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
