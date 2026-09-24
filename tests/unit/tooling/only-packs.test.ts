/**
 * @file tests/unit/tooling/only-packs.test.ts
 * @desc packs is only packs: tournament pool data lives in pools.haruhime.moe, so the pool
 *       importer, its otdb fixtures, the route it refreshed /packs through, and map usage with its
 *       per-IP limit are gone for good, and the repo's own docs no longer describe them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/constants/api";

const at = (file: string) => path.join(process.cwd(), file);

describe("removed for good", () => {
  it.each([
    "scripts",
    "src/lib/archive-import.ts",
    "src/utils/archive-import.ts",
    "src/utils/archive-pools.ts",
    "src/utils/archive-names.ts",
    "src/utils/otdb.ts",
    "src/schemas/otdb.ts",
    "src/app/api/cron/revalidate-packs",
    "tests/fixtures/otdb",
    "src/app/api/v1/beatmaps",
    "src/constants/map-usage.ts",
    "src/schemas/map-usage.ts",
    "src/services/map-usage.ts",
    "src/utils/map-usage.ts",
    "src/hooks/useMapUsage.ts",
    "src/components/pack/MapUsage.tsx",
    "src/schemas/archive.ts",
    "src/components/pack/ArchiveBadge.tsx",
    "content/guide/archived-pools.mdx",
  ])("%s is gone", (file) => {
    expect(existsSync(at(file))).toBe(false);
  });

  it("has no archive:import script", () => {
    const pkg = JSON.parse(readFileSync(at("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(Object.keys(pkg.scripts)).not.toContain("archive:import");
  });

  it("keeps no per-IP limit for map usage", () => {
    expect(Object.keys(RATE_LIMITS)).not.toContain("mapUsage");
  });
});

describe("the repo's own docs", () => {
  it.each(["README.md", "llms.txt", "AGENTS.md", "SECURITY.md", ".env.example"])(
    "%s no longer describes map usage, archived pools or the importer",
    (file) => {
      expect(readFileSync(at(file), "utf8")).not.toMatch(
        /map usage|archived pools?|archive packs?|archive:import|revalidate-packs|Used in N pools/i,
      );
    },
  );
});
