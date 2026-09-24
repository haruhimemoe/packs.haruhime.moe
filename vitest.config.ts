/**
 * @file vitest.config.ts
 * @desc Vitest config: three projects (unit / components / integration) over the tests/ tree,
 *       shared path aliases, v8 coverage with a 90% floor on src/utils.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@content": path.resolve(root, "content"),
      // server-only throws outside React Server Components; tests run plain Node.
      "server-only": path.resolve(root, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text", "html"],
      thresholds: {
        "src/utils/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "src/schemas/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          // A timezone west of UTC so date formatting bugs surface in tests.
          env: { TZ: "America/Los_Angeles" },
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["tests/setup/components.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/setup/integration-global.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          // One in-memory server and one "packs" database: files take turns.
          fileParallelism: false,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
