/**
 * @file tests/unit/utils/slot-stars.test.ts
 * @desc What each slot plays with, what its star badge shows (forced, freemod, calculating,
 *       failed), the star-rating pairs a pool asks the server for, the ratings each slot gets
 *       back, and the stars pack stats use.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { NO_MODS, type SlotMods } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { BucketEntry, PoolSlot } from "@/schemas/pack";
import {
  MODDED_FAILED_NOTE,
  MODDED_LOADING_NOTE,
  moddedStarsOf,
  ratingsForSlots,
  STAR_FAILED,
  type StarPairResult,
  slotModsMap,
  slotStars,
  starPairKey,
  starPairsFor,
} from "@/utils/slot-stars";

const BUCKETS: BucketEntry[] = [
  { code: "NM" },
  { code: "HD" },
  { code: "HR" },
  { code: "DT" },
  { code: "FM" },
  { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
  { code: "X", color: 1 },
  { code: "TB" },
];
const HD: SlotMods = { kind: "forced", set: ["HD"] };
const meta = { starRating: 5.8 } as BeatmapMeta;

describe("slotModsMap", () => {
  it("maps every slot to what it plays with", () => {
    const slots: PoolSlot[] = [
      { mod: "NM", index: 1, beatmapId: 1 },
      { mod: "HD", index: 1, beatmapId: 2 },
      { mod: "FM", index: 1, beatmapId: 3 },
      { mod: "EZ", index: 1, beatmapId: 4 },
      { mod: "X", index: 1, beatmapId: 5 },
      { mod: null, index: 1, beatmapId: 6 },
      { mod: "Gone", index: 1, beatmapId: 7 },
    ];
    expect([...slotModsMap(slots, BUCKETS)]).toEqual([
      ["b:NM#1", NO_MODS],
      ["b:HD#1", HD],
      ["b:FM#1", { kind: "free" }],
      ["b:EZ#1", { kind: "forced", set: ["EZ"] }],
      ["b:X#1", NO_MODS],
      ["#1", NO_MODS],
      ["b:Gone#1", NO_MODS],
    ]);
  });
});

describe("slotStars", () => {
  it("shows the plain rating for a slot without mods", () => {
    expect(slotStars(5.8, NO_MODS, undefined)).toEqual({ stars: 5.8 });
    expect(slotStars(5.8, undefined, undefined)).toEqual({ stars: 5.8 });
  });

  it("shows a forced slot's modded rating with the plain one in the title", () => {
    expect(slotStars(5.8, HD, [{ mods: "HD", stars: 6.02 }])).toEqual({
      stars: 6.02,
      title: "5.80★ without mods",
      label: "with HD, 5.80 without mods",
    });
  });

  it("names every forced mod for screen readers", () => {
    expect(
      slotStars(5.8, { kind: "forced", set: ["HD", "DT"] }, [{ mods: "HDDT", stars: 8.1 }]).label,
    ).toBe("with HD DT, 5.80 without mods");
  });

  it("keeps the plain rating with a loading note on a forced slot while calculating", () => {
    expect(MODDED_LOADING_NOTE).toBe("Rating with mods loading. This is the rating without mods.");
    expect(slotStars(5.8, HD, undefined)).toEqual({
      stars: 5.8,
      title: MODDED_LOADING_NOTE,
      label: MODDED_LOADING_NOTE,
    });
  });

  it("keeps a freemod slot's plain rating as it is while calculating (it is the right number)", () => {
    expect(slotStars(5.8, { kind: "free" }, undefined)).toEqual({ stars: 5.8 });
  });

  it("falls back with a note when the calculation failed", () => {
    const failed = { stars: 5.8, title: MODDED_FAILED_NOTE, label: MODDED_FAILED_NOTE };
    expect(slotStars(5.8, HD, [])).toEqual(failed);
    expect(slotStars(5.8, { kind: "free" }, [])).toEqual(failed);
  });

  it("adds a freemod row under the plain rating", () => {
    expect(
      slotStars(5.8, { kind: "free" }, [
        { mods: "HD", stars: 6.02 },
        { mods: "HR", stars: 6.31 },
        { mods: "HDHR", stars: 6.55 },
        { mods: "EZ", stars: 4.12 },
      ]),
    ).toEqual({ stars: 5.8, freemod: ["HD 6.02", "HR 6.31", "HDHR 6.55", "EZ 4.12"] });
  });
});

describe("moddedStarsOf", () => {
  const modsBySlot = new Map<string, SlotMods>([
    ["b:HD#1", HD],
    ["b:FM#1", { kind: "free" }],
    ["b:HR#1", { kind: "forced", set: ["HR"] }],
  ]);
  const ratings = new Map([
    ["b:HD#1", [{ mods: "HD", stars: 6.02 }]],
    ["b:FM#1", [{ mods: "HD", stars: 6.02 }]],
    ["b:HR#1", []],
  ]);
  const starsOf = moddedStarsOf(modsBySlot, ratings);

  it("uses a forced slot's modded rating", () => {
    expect(starsOf({ mod: "HD", index: 1, beatmapId: 1 }, meta)).toBe(6.02);
  });

  it("uses the plain rating for freemod, failed, unknown, and plain slots", () => {
    expect(starsOf({ mod: "FM", index: 1, beatmapId: 1 }, meta)).toBe(5.8);
    expect(starsOf({ mod: "HR", index: 1, beatmapId: 1 }, meta)).toBe(5.8);
    expect(starsOf({ mod: "NM", index: 1, beatmapId: 1 }, meta)).toBe(5.8);
  });
});

describe("star-rating pairs", () => {
  const full = (beatmapId: number, mode: BeatmapMeta["mode"] = "osu"): MetaState => ({
    status: "found",
    meta: { ...meta, beatmapId, mode, starRating: 5 },
  });
  const getter =
    (states: Record<number, MetaState>) =>
    (id: number): MetaState =>
      states[id] ?? { status: "loading" };
  const slots: PoolSlot[] = [
    { mod: "HD", index: 1, beatmapId: 8 },
    { mod: "FM", index: 1, beatmapId: 8 },
    { mod: "NM", index: 1, beatmapId: 7 },
    { mod: "TB", index: 1, beatmapId: 9 },
    { mod: "DT", index: 1, beatmapId: 10 },
  ];
  const mods = slotModsMap(slots, BUCKETS);

  it("keys a pair by beatmap id and mod label", () => {
    expect(starPairKey(129891, ["HD", "HR"])).toBe("129891:HDHR");
  });

  it("lists every pair the pool needs once, sorted, skipping no-mod slots and unloaded maps", () => {
    const pairs = starPairsFor(
      slots,
      getter({ 7: full(7), 8: full(8), 9: full(9, "mania") }),
      mods,
    );
    // 8:HD comes from both HD1 and FM1 but is asked for once; 10 (DT1) isn't loaded yet;
    // 9 is mania, so its freemod slot only needs HD.
    expect(pairs).toEqual(["8:EZ", "8:HD", "8:HDHR", "8:HR", "9:HD"]);
  });

  it("gives each slot its ratings in display order once every pair is known", () => {
    const results = new Map<string, StarPairResult>([
      ["8:HD", 6.1],
      ["8:HR", 6.2],
      ["8:HDHR", 6.3],
      ["8:EZ", 4.5],
    ]);
    const ratings = ratingsForSlots(slots, getter({ 8: full(8) }), mods, results);
    expect(ratings.get("b:HD#1")).toEqual([{ mods: "HD", stars: 6.1 }]);
    expect(ratings.get("b:FM#1")).toEqual([
      { mods: "HD", stars: 6.1 },
      { mods: "HR", stars: 6.2 },
      { mods: "HDHR", stars: 6.3 },
      { mods: "EZ", stars: 4.5 },
    ]);
    expect(ratings.has("b:NM#1")).toBe(false);
  });

  it("leaves a slot out while a pair is unknown, and gives [] once one failed", () => {
    const waiting = new Map<string, StarPairResult>([["8:HD", 6.1]]);
    expect(ratingsForSlots(slots, getter({ 8: full(8) }), mods, waiting).has("b:FM#1")).toBe(false);
    const failed = new Map<string, StarPairResult>([
      ["8:HD", 6.1],
      ["8:HR", STAR_FAILED],
    ]);
    expect(ratingsForSlots(slots, getter({ 8: full(8) }), mods, failed).get("b:FM#1")).toEqual([]);
  });
});
