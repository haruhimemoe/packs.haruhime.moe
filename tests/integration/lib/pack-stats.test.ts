/**
 * @file tests/integration/lib/pack-stats.test.ts
 * @desc Server lookups for pack stats: the mirror 100 ids a call, osu! only for what the mirror
 *       lacks (or a failed mirror call), within a call cap and the global budget; maps osu! says
 *       don't exist as null, unchecked ones absent; ratings with mods as rated, refused (null) or
 *       still pending (absent). The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { OSU_API_BUDGET, RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { osuBudgetWindow } from "@/lib/osu/attributes";
import { lookupModRatings, lookupStatsMeta } from "@/lib/pack-stats";
import { setupTestDb } from "../../helpers/db";
import { beatmapRow, onMirror, setupStatsLookups } from "../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

describe("lookupStatsMeta", () => {
  it("asks the mirror at most 100 ids a call, each id once", async () => {
    const ids = range(1, 250);
    onMirror(lookups, ...ids.map((id) => beatmapRow(id)));

    const found = await lookupStatsMeta([...ids, 1, 2, 3]);

    expect(found.size).toBe(250);
    expect(lookups.calls.mirror.map((call) => call.split(",").length).sort()).toEqual([
      100, 100, 50,
    ]);
    expect(lookups.calls.osuBeatmaps).toEqual([]);
  });

  it("sends the ids of a failed mirror call to osu!", async () => {
    lookups.mirrorDown = true;
    lookups.osu.set(5, beatmapRow(5, { difficulty_rating: 2 }));

    const found = await lookupStatsMeta([5, 6]);

    expect(found.get(5)?.starRating).toBe(2);
    expect(lookups.calls.osuBeatmaps).toEqual(["5,6"]);
  });

  it("marks maps osu! says don't exist as null, apart from maps it couldn't check", async () => {
    onMirror(lookups, beatmapRow(1));
    lookups.osu.set(2, beatmapRow(2));

    const found = await lookupStatsMeta([1, 2, 3]);

    expect(found.get(1)).toBeTruthy();
    expect(found.get(2)).toBeTruthy();
    expect(found.has(3)).toBe(true);
    expect(found.get(3)).toBeNull();
  });

  it("stops asking osu! at the call cap and leaves the unchecked ids out", async () => {
    const found = await lookupStatsMeta(range(1, 200), { maxOsuCalls: 2 });

    expect(lookups.calls.osuBeatmaps).toHaveLength(2);
    // Two calls of 50 checked ids 1 to 100: osu! doesn't know them. 101 to 200 went unasked.
    expect(found.size).toBe(100);
    expect([...found.values()].every((meta) => meta === null)).toBe(true);
    expect(found.has(101)).toBe(false);
  });

  it("doesn't ask osu! once the global budget is spent", async () => {
    const { id, expiresAt } = osuBudgetWindow(Date.now());
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertOne({ _id: id, count: OSU_API_BUDGET.limit, expiresAt });

    expect((await lookupStatsMeta([9])).size).toBe(0);
    expect(lookups.calls.osuBeatmaps).toEqual([]);
  });

  it("gives up quietly when osu! fails, leaving the ids unchecked", async () => {
    lookups.osuDown = true;
    expect((await lookupStatsMeta([9])).size).toBe(0);
  });
});

describe("lookupModRatings", () => {
  const pair = (beatmapId: number, mod: "DT" | "HR") => ({
    key: `${beatmapId}:${mod}`,
    beatmapId,
    set: [mod],
  });

  it("maps rated pairs to numbers and refused ones to null", async () => {
    lookups.ratings.set("1:DT", 7.5);
    lookups.ratings.set("2:HR", "refuse");

    const ratings = await lookupModRatings([pair(1, "DT"), pair(2, "HR")]);

    expect([...ratings]).toEqual([
      ["1:DT", 7.5],
      ["2:HR", null],
    ]);
  });

  it("leaves pairs osu! couldn't answer yet out", async () => {
    lookups.osuDown = true;
    expect((await lookupModRatings([pair(1, "DT")])).size).toBe(0);
  });

  it("asks nothing for no pairs", async () => {
    expect((await lookupModRatings([])).size).toBe(0);
    expect(lookups.calls.attributes).toEqual([]);
  });
});
