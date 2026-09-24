/**
 * @file tests/unit/utils/saved-pack-stats.test.ts
 * @desc Pack stats from slots and metadata (filters spec): plain and mod-adjusted star ratings,
 *       DT/HT length and BPM, the mod codes a pack has, rulesets, missing maps and ratings, maps
 *       osu! says are gone (left out, still complete), seeded metadata without a plain rating,
 *       mixed modes, an empty pack, rounding; the rating pairs a pack needs; when the job may retry
 *       incomplete stats; the compact index form.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import type { PoolSlot } from "@/schemas/pack";
import {
  computeStats,
  type ModRatings,
  type PackStatsRecord,
  type StatsMeta,
  statsPairsFor,
  statsRetryAt,
  toIndexStats,
  toPackStatsDto,
} from "@/utils/saved-pack-stats";

const NOW = new Date("2026-09-24T12:00:00.000Z");

const meta = (overrides: Partial<StatsMeta> = {}): StatsMeta => ({
  mode: "osu",
  starRating: 5,
  lengthSeconds: 120,
  bpm: 180,
  ...overrides,
});

const slot = (mod: string | null, index: number, beatmapId: number): PoolSlot => ({
  mod,
  index,
  beatmapId,
});

const metas = (entries: [number, Partial<StatsMeta>][]): Map<number, StatsMeta> =>
  new Map(entries.map(([id, overrides]) => [id, meta(overrides)]));

const NO_RATINGS: ModRatings = new Map();

/** Built-ins plus custom slots: forced sets, a freemod slot, and one with no mods. */
const CUSTOM: BucketEntry[] = [
  { code: "NM" },
  { code: "HD" },
  { code: "HR" },
  { code: "DT" },
  { code: "FM" },
  { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
  { code: "HT", color: 1, mods: { kind: "forced", set: ["HT"] } },
  { code: "FL", color: 2, mods: { kind: "forced", set: ["FL"] } },
  { code: "HDDT", color: 3, mods: { kind: "forced", set: ["HD", "DT"] } },
  { code: "HDHR", color: 4, mods: { kind: "forced", set: ["HD", "HR"] } },
  { code: "HID", color: 5, mods: { kind: "forced", set: ["HD"] } },
  { code: "Free", color: 6, mods: { kind: "free" } },
  { code: "Rice", color: 7 },
  { code: "TB" },
];

describe("computeStats", () => {
  it("gives an empty pack null ranges and no mods or modes", () => {
    expect(computeStats([], undefined, new Map(), NO_RATINGS, NOW)).toEqual({
      srMin: null,
      srMax: null,
      srAvg: null,
      lenMin: null,
      lenMax: null,
      bpmMin: null,
      bpmMax: null,
      mods: [],
      modes: [],
      count: 0,
      complete: true,
      computedAt: NOW,
    });
  });

  it("counts NM, HD, FM and TB slots with the plain rating and no speed change", () => {
    const slots = [slot("NM", 1, 1), slot("HD", 1, 2), slot("FM", 1, 3), slot("TB", 1, 4)];
    const byId = metas([
      [1, { starRating: 4.5, lengthSeconds: 90, bpm: 150 }],
      [2, { starRating: 5.5 }],
      [3, { starRating: 6 }],
      [4, { starRating: 7, lengthSeconds: 300, bpm: 200 }],
    ]);
    // A cached HD rating is ignored: HD slots count without mods.
    const ratings: ModRatings = new Map([["2:HD", 9]]);
    expect(computeStats(slots, undefined, byId, ratings, NOW)).toEqual({
      srMin: 4.5,
      srMax: 7,
      srAvg: 5.75,
      lenMin: 90,
      lenMax: 300,
      bpmMin: 150,
      bpmMax: 200,
      mods: ["NM", "HD", "FM", "TB"],
      modes: ["osu"],
      count: 4,
      complete: true,
      computedAt: NOW,
    });
  });

  it("counts a DT slot with its DT rating, length divided and BPM multiplied by 1.5", () => {
    const slots = [slot("DT", 1, 5)];
    const byId = metas([[5, { starRating: 5, lengthSeconds: 150, bpm: 200 }]]);
    const stats = computeStats(slots, undefined, byId, new Map([["5:DT", 7.25]]), NOW);
    expect(stats).toMatchObject({
      srMin: 7.25,
      srMax: 7.25,
      srAvg: 7.25,
      lenMin: 100,
      lenMax: 100,
      bpmMin: 300,
      bpmMax: 300,
      mods: ["DT"],
      complete: true,
    });
  });

  it("counts an HR slot with its HR rating and keeps its length and BPM", () => {
    const byId = metas([[6, { starRating: 5, lengthSeconds: 150, bpm: 200 }]]);
    const stats = computeStats([slot("HR", 1, 6)], undefined, byId, new Map([["6:HR", 5.6]]), NOW);
    expect(stats).toMatchObject({ srMin: 5.6, lenMin: 150, bpmMin: 200, mods: ["HR"] });
  });

  it("rates custom forced sets as a whole, and slows or speeds HT and DT sets", () => {
    const slots = [
      slot("EZ", 1, 10),
      slot("HT", 1, 11),
      slot("FL", 1, 12),
      slot("HDDT", 1, 13),
      slot("HDHR", 1, 14),
    ];
    const byId = metas([
      [10, { lengthSeconds: 100, bpm: 100 }],
      [11, { lengthSeconds: 150, bpm: 200 }],
      [12, { lengthSeconds: 100, bpm: 100 }],
      [13, { lengthSeconds: 90, bpm: 160 }],
      [14, { lengthSeconds: 100, bpm: 100 }],
    ]);
    const ratings: ModRatings = new Map([
      ["10:EZ", 2],
      ["11:HT", 3],
      ["12:FL", 6],
      ["13:HDDT", 8],
      ["14:HDHR", 6.5],
    ]);
    expect(computeStats(slots, CUSTOM, byId, ratings, NOW)).toMatchObject({
      srMin: 2,
      srMax: 8,
      srAvg: 5.1,
      // HT: 150 / 0.75 = 200 s at 150 BPM; HDDT: 90 / 1.5 = 60 s at 240 BPM.
      lenMin: 60,
      lenMax: 200,
      bpmMin: 100,
      bpmMax: 240,
      mods: ["HD", "HR", "DT", "EZ", "HT", "FL"],
      complete: true,
    });
  });

  it("counts a custom HD-only, freemod or no-mod slot with the plain rating", () => {
    const slots = [slot("HID", 1, 20), slot("Free", 1, 21), slot("Rice", 1, 22)];
    const byId = metas([
      [20, { starRating: 4 }],
      [21, { starRating: 5 }],
      [22, { starRating: 6 }],
    ]);
    expect(computeStats(slots, CUSTOM, byId, NO_RATINGS, NOW)).toMatchObject({
      srMin: 4,
      srMax: 6,
      srAvg: 5,
      // Custom freemod counts as FM; a custom slot with no mods adds no code.
      mods: ["HD", "FM"],
      complete: true,
    });
  });

  it("counts a no-slot map with the plain rating and adds no mod", () => {
    const byId = metas([[30, { starRating: 3.33 }]]);
    expect(computeStats([slot(null, 1, 30)], undefined, byId, NO_RATINGS, NOW)).toMatchObject({
      srMin: 3.33,
      mods: [],
      count: 1,
      complete: true,
    });
  });

  it("leaves out a map without metadata and marks the stats incomplete", () => {
    const slots = [slot("NM", 1, 40), slot("HR", 1, 41)];
    const byId = metas([[40, { starRating: 4, lengthSeconds: 100, bpm: 120 }]]);
    expect(computeStats(slots, undefined, byId, NO_RATINGS, NOW)).toMatchObject({
      srMin: 4,
      srMax: 4,
      lenMax: 100,
      bpmMax: 120,
      // The slot still counts, and so does its mod.
      mods: ["NM", "HR"],
      count: 2,
      complete: false,
    });
  });

  it("leaves a map out of star rating while its mod rating is unknown, but keeps its length", () => {
    const slots = [slot("NM", 1, 50), slot("DT", 1, 51)];
    const byId = metas([
      [50, { starRating: 4, lengthSeconds: 100, bpm: 120 }],
      [51, { starRating: 5, lengthSeconds: 150, bpm: 200 }],
    ]);
    expect(computeStats(slots, undefined, byId, NO_RATINGS, NOW)).toMatchObject({
      srMin: 4,
      srMax: 4,
      srAvg: 4,
      lenMin: 100,
      lenMax: 100,
      bpmMax: 300,
      complete: false,
    });
  });

  it("falls back to the plain rating when osu! won't rate the mods", () => {
    const byId = metas([[60, { starRating: 4.2 }]]);
    const ratings: ModRatings = new Map([["60:HR", null]]);
    expect(computeStats([slot("HR", 1, 60)], undefined, byId, ratings, NOW)).toMatchObject({
      srMin: 4.2,
      complete: true,
    });
  });

  it("counts a map without a known plain rating for length and BPM, and marks stars missing", () => {
    // Seeded metadata (an archive import) may only know the map's rating with mods.
    const byId = metas([
      [70, { starRating: null, lengthSeconds: 90, bpm: 200 }],
      [71, { starRating: 6 }],
    ]);
    expect(
      computeStats([slot("NM", 1, 70), slot("NM", 2, 71)], undefined, byId, NO_RATINGS, NOW),
    ).toMatchObject({ srMin: 6, srMax: 6, lenMin: 90, bpmMax: 200, complete: false });
    // Its rating with mods still counts once known.
    const ratings: ModRatings = new Map([["70:DT", 7.5]]);
    expect(computeStats([slot("DT", 1, 70)], undefined, byId, ratings, NOW)).toMatchObject({
      srMin: 7.5,
      lenMin: 60,
      complete: true,
    });
    // osu! won't rate the set and the plain rating isn't known: missing.
    const unrated: ModRatings = new Map([["70:HR", null]]);
    expect(computeStats([slot("HR", 1, 70)], undefined, byId, unrated, NOW)).toMatchObject({
      srMin: null,
      complete: false,
    });
  });

  it("lists every ruleset present, in osu!'s order", () => {
    const slots = [slot("NM", 1, 70), slot("NM", 2, 71), slot("NM", 3, 72)];
    const byId = metas([
      [70, { mode: "mania" }],
      [71, { mode: "osu" }],
      [72, { mode: "taiko" }],
    ]);
    expect(computeStats(slots, undefined, byId, NO_RATINGS, NOW).modes).toEqual([
      "osu",
      "taiko",
      "mania",
    ]);
  });

  it("has null ranges when no map's metadata arrived", () => {
    const stats = computeStats([slot("NM", 1, 80)], undefined, new Map(), NO_RATINGS, NOW);
    expect(stats).toMatchObject({
      srMin: null,
      srAvg: null,
      lenMin: null,
      bpmMin: null,
      modes: [],
      mods: ["NM"],
      complete: false,
    });
  });

  it("leaves out a map osu! says doesn't exist without making the stats incomplete", () => {
    const slots = [slot("NM", 1, 1), slot("DT", 1, 2), slot("HR", 1, 3)];
    const byId = new Map<number, StatsMeta | null>([
      [1, meta({ starRating: 4, mode: "taiko" })],
      [2, null],
      [3, null],
    ]);
    expect(computeStats(slots, undefined, byId, NO_RATINGS, NOW)).toMatchObject({
      srMin: 4,
      srMax: 4,
      srAvg: 4,
      mods: ["NM", "HR", "DT"],
      modes: ["taiko"],
      count: 3,
      complete: true,
    });
  });

  it("is still incomplete when a gone map sits next to one nobody could check", () => {
    const slots = [slot("NM", 1, 1), slot("NM", 2, 2)];
    const byId = new Map<number, StatsMeta | null>([[1, null]]);
    expect(computeStats(slots, undefined, byId, NO_RATINGS, NOW)).toMatchObject({
      srMin: null,
      modes: [],
      complete: false,
    });
  });

  it("counts a map in two slots twice", () => {
    const slots = [slot("NM", 1, 90), slot("DT", 1, 90)];
    const byId = metas([[90, { starRating: 5 }]]);
    expect(computeStats(slots, undefined, byId, new Map([["90:DT", 7]]), NOW)).toMatchObject({
      srAvg: 6,
      count: 2,
    });
  });

  it("rounds stars to 2 decimals and length and BPM to whole numbers", () => {
    const slots = [slot("NM", 1, 1), slot("DT", 1, 2)];
    const byId = metas([
      [1, { starRating: 5.126, lengthSeconds: 127, bpm: 119.999 }],
      [2, { starRating: 7.805789947509766, lengthSeconds: 258, bpm: 222.22000122070312 }],
    ]);
    expect(computeStats(slots, undefined, byId, new Map([["2:DT", 10.1234]]), NOW)).toMatchObject({
      srMin: 5.13,
      srMax: 10.12,
      srAvg: 7.62,
      lenMin: 127,
      lenMax: 172,
      bpmMin: 120,
      bpmMax: 333,
    });
  });
});

describe("statsPairsFor", () => {
  it("asks for each rating-changing forced set once, for maps with metadata, sorted", () => {
    const slots = [
      slot("NM", 1, 1),
      slot("HD", 1, 2),
      slot("DT", 1, 3),
      slot("DT", 2, 3),
      slot("HR", 1, 4),
      slot("HDDT", 1, 5),
      slot("HID", 1, 6),
      slot("Free", 1, 7),
      slot("TB", 1, 8),
      slot(null, 1, 9),
      slot("FL", 1, 10),
    ];
    const byId = metas(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id): [number, Partial<StatsMeta>] => [id, {}]),
    );
    expect(statsPairsFor(slots, CUSTOM, byId)).toEqual([
      { key: "3:DT", beatmapId: 3, set: ["DT"] },
      { key: "4:HR", beatmapId: 4, set: ["HR"] },
      { key: "5:HDDT", beatmapId: 5, set: ["HD", "DT"] },
    ]);
  });

  it("asks for nothing for a map osu! says doesn't exist", () => {
    const byId = new Map<number, StatsMeta | null>([[3, null]]);
    expect(statsPairsFor([slot("DT", 1, 3)], undefined, byId)).toEqual([]);
  });

  it("asks for nothing when the pack has no mod slots", () => {
    expect(statsPairsFor([slot("NM", 1, 1)], undefined, metas([[1, {}]]))).toEqual([]);
  });
});

const FULL: PackStatsRecord = {
  srMin: 5.12,
  srMax: 7.81,
  srAvg: 6.3,
  lenMin: 90,
  lenMax: 258,
  bpmMin: 120,
  bpmMax: 333,
  mods: ["NM", "HD", "DT"],
  modes: ["osu", "taiko"],
  count: 3,
  complete: true,
  computedAt: NOW,
};

describe("toIndexStats", () => {
  it("packs the ranges, mods and modes into the index's short keys", () => {
    expect(toIndexStats(FULL)).toEqual({
      r: [5.12, 7.81],
      a: 6.3,
      l: [90, 258],
      b: [120, 333],
      m: "NM,HD,DT",
      g: "osu,taiko",
      k: true,
    });
  });

  it("leaves out ranges it doesn't know", () => {
    expect(
      toIndexStats({
        ...FULL,
        srMin: null,
        srMax: null,
        srAvg: null,
        lenMin: null,
        lenMax: null,
        bpmMin: null,
        bpmMax: null,
        mods: [],
        modes: [],
        complete: false,
      }),
    ).toEqual({ m: "", g: "", k: false });
  });

  it("keeps length and BPM when only the star rating is unknown", () => {
    expect(toIndexStats({ ...FULL, srMin: null, srMax: null, srAvg: null })).toEqual({
      l: [90, 258],
      b: [120, 333],
      m: "NM,HD,DT",
      g: "osu,taiko",
      k: true,
    });
  });
});

describe("statsRetryAt", () => {
  const HOUR = 3_600_000;
  const waitHours = (attempts: number) =>
    (statsRetryAt(NOW, attempts).getTime() - NOW.getTime()) / HOUR;

  it("lets the next run retry right after the first incomplete result", () => {
    expect(waitHours(1)).toBe(0);
    expect(waitHours(0)).toBe(0);
  });

  it("then waits about 1, 2, 4, 8 and 16 days, each an hour short so a daily run counts", () => {
    expect([2, 3, 4, 5, 6].map(waitHours)).toEqual([23, 47, 95, 191, 383]);
  });

  it("never waits more than 30 days", () => {
    expect(waitHours(7)).toBe(30 * 24 - 1);
    expect(waitHours(40)).toBe(30 * 24 - 1);
  });
});

describe("toPackStatsDto", () => {
  it("turns computedAt into an ISO string", () => {
    expect(toPackStatsDto(FULL)).toEqual({ ...FULL, computedAt: "2026-09-24T12:00:00.000Z" });
  });
});
