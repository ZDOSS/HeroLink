import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.ts",
        "src/plugin/**/*.js",
        "electron/**/*.mjs",
        "electron/renderer/**/*.js",
      ],
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "test/",
        "scripts/",
        "src/cli.ts",
        "src/index.ts",
        "src/schema/index.ts",
      ],
      thresholds: {
        "src/io/**": { lines: 90, branches: 90, functions: 90 },
        "src/mutate/**": { lines: 90, branches: 90 },
        "src/validate/**": { lines: 90, branches: 90 },
        "src/model/**": { lines: 90, branches: 80, functions: 90 },
        "src/schema/**": { lines: 90, branches: 90, functions: 90 },
        lines: 75,
        branches: 75,
        functions: 70,
      },
    },
  },
});
