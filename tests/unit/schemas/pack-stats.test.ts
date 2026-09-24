/**
 * @file tests/unit/schemas/pack-stats.test.ts
 * @desc Pack stats as sent (nullable ranges, known mod codes and rulesets only) and their compact
 *       index form (ranges optional, m/g/k always there).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { indexStatsSchema, packStatsSchema } from "@/schemas/pack-stats";

const STATS = {
  srMin: 5.12,
  srMax: 7.81,
  srAvg: 6.3,
  lenMin: 90,
  lenMax: 258,
  bpmMin: 120,
  bpmMax: 333,
  mods: ["NM", "HD", "EZ"],
  modes: ["osu"],
  count: 3,
  complete: true,
  computedAt: "2026-09-24T12:00:00.000Z",
};

describe("packStatsSchema", () => {
  it("accepts stats, and null ranges", () => {
    expect(packStatsSchema.parse(STATS)).toEqual(STATS);
    const unknown = { ...STATS, srMin: null, srMax: null, srAvg: null, lenMin: null };
    expect(packStatsSchema.parse(unknown)).toEqual(unknown);
  });

  it.each([
    ["an unknown mod", { mods: ["NC"] }],
    ["an unknown ruleset", { modes: ["catch"] }],
    ["a fractional length", { lenMin: 90.5 }],
    ["a negative count", { count: -1 }],
  ])("refuses %s", (_label, change) => {
    expect(packStatsSchema.safeParse({ ...STATS, ...change }).success).toBe(false);
  });
});

describe("indexStatsSchema", () => {
  it("takes the full compact form and the one without ranges", () => {
    const full = {
      r: [5.12, 7.81],
      a: 6.3,
      l: [90, 258],
      b: [120, 333],
      m: "NM,HD",
      g: "osu",
      k: true,
    };
    expect(indexStatsSchema.parse(full)).toEqual(full);
    expect(indexStatsSchema.parse({ m: "", g: "", k: false })).toEqual({ m: "", g: "", k: false });
  });

  it("wants ranges as two numbers", () => {
    expect(indexStatsSchema.safeParse({ r: [5], m: "", g: "", k: true }).success).toBe(false);
  });
});
