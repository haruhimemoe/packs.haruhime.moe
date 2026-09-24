/**
 * @file tests/unit/schemas/map-usage.test.ts
 * @desc Map usage shapes: the `{id}` segment and the `?ids=` list the usage routes take (digits
 *       only, valid ids, 1 to MAX_USAGE_IDS as sent, each id once in the order sent), and the
 *       answers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { MAX_USAGE_IDS } from "@/constants/map-usage";
import { MAX_SLOTS } from "@/constants/pack";
import {
  beatmapIdTextSchema,
  beatmapUsageListSchema,
  beatmapUsageSchema,
  usageIdsQuerySchema,
} from "@/schemas/map-usage";

const ENTRY = {
  slug: "aaaaaaaaaa",
  tournament: "Spring Cup",
  round: null,
  year: null,
  badged: null,
  slot: "NM1",
  mods: "NM",
};

describe("beatmapIdTextSchema", () => {
  it.each([
    ["75", 75],
    ["007", 7],
    ["2147483647", 2147483647],
  ])("reads %j as %i", (text, id) => {
    expect(beatmapIdTextSchema.parse(text)).toBe(id);
  });

  it.each(["", "0", "-1", "1.5", "1e3", " 1", "abc", "2147483648", "12345678901"])(
    "refuses %j",
    (text) => {
      expect(beatmapIdTextSchema.safeParse(text).success).toBe(false);
    },
  );
});

describe("usageIdsQuerySchema", () => {
  it("reads ids in the order sent, each once, and skips empty items", () => {
    expect(usageIdsQuerySchema.parse("3,1,,3,2,")).toEqual([3, 1, 2]);
  });

  it(`takes ${MAX_USAGE_IDS} ids, and a whole pack always fits`, () => {
    const ids = Array.from({ length: MAX_USAGE_IDS }, (_, i) => 2147483647 - i);
    expect(usageIdsQuerySchema.parse(ids.join(","))).toEqual(ids);
    expect(MAX_SLOTS).toBeLessThanOrEqual(MAX_USAGE_IDS);
  });

  it.each([
    ["nothing", ""],
    ["only commas", ",,"],
    ["a bad id", "1,x"],
    ["a zero", "1,0"],
    ["too many ids", Array.from({ length: MAX_USAGE_IDS + 1 }, (_, i) => i + 1).join(",")],
    ["too many repeats", Array.from({ length: MAX_USAGE_IDS + 1 }, () => 1).join(",")],
    ["an overlong text", "1".repeat(MAX_USAGE_IDS * 11 + 1)],
  ])("refuses %s", (_label, text) => {
    expect(usageIdsQuerySchema.safeParse(text).success).toBe(false);
  });
});

describe("usage answers", () => {
  it("parse a map's usage and a list of them", () => {
    const usage = { beatmapId: 75, count: 1, entries: [ENTRY] };
    expect(beatmapUsageSchema.parse(usage)).toEqual(usage);
    expect(beatmapUsageListSchema.parse({ beatmaps: [usage] })).toEqual({ beatmaps: [usage] });
  });

  it("refuse a negative count and a bad slug", () => {
    expect(beatmapUsageSchema.safeParse({ beatmapId: 75, count: -1, entries: [] }).success).toBe(
      false,
    );
    expect(
      beatmapUsageSchema.safeParse({ beatmapId: 75, count: 1, entries: [{ ...ENTRY, slug: "x" }] })
        .success,
    ).toBe(false);
  });
});
