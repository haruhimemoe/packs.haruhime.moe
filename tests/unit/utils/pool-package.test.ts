/**
 * @file tests/unit/utils/pool-package.test.ts
 * @desc Packs' stored pool shape still validates with the package, and a full pool keeps its key.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { decodePackKey, encodePackKey, type Pool, poolSchema } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { packInputSchema } from "@/schemas/saved-pack";

const pool: Pool = {
  name: "SPC Finals",
  slots: [
    { mod: null, index: 1, beatmapId: 75 },
    { mod: "NM", index: 1, beatmapId: 129891 },
    { mod: "EZ", index: 1, beatmapId: 4000000 },
    { mod: "TB", index: 1, beatmapId: 1872396 },
  ],
  buckets: [
    { code: "NM" },
    { code: "HD" },
    { code: "HR" },
    { code: "DT" },
    { code: "FM" },
    { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
    { code: "TB" },
  ],
};

describe("@haruhimemoe/pool in packs", () => {
  it("round-trips a pk3 pool through the key", () => {
    const key = encodePackKey(pool);
    expect(key.startsWith("pk3.")).toBe(true);
    expect(encodePackKey(decodePackKey(key))).toBe(key);
  });

  it("validates the pool fields packs stores", () => {
    expect(poolSchema.safeParse(pool).success).toBe(true);
    expect(
      packInputSchema.safeParse({
        ...pool,
        visibility: "public",
        description: "Finals of the Spring Cup.",
      }).success,
    ).toBe(true);
  });
});
