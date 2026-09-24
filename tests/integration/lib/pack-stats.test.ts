/**
 * @file tests/integration/lib/pack-stats.test.ts
 * @desc Server lookups for pack stats: the mirror 100 ids a call, osu! only for what the mirror
 *       lacks (or a failed mirror call), within a call cap and the global budget; ratings with
 *       mods as rated, refused (null) or still pending (absent). The mirror and osu! are MSW.
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

    expect([...found.keys()]).toEqual([5]);
    expect(lookups.calls.osuBeatmaps).toEqual(["5,6"]);
  });

  it("stops asking osu! at the call cap", async () => {
    const found = await lookupStatsMeta(range(1, 200), { maxOsuCalls: 2 });

    expect(found.size).toBe(0);
    expect(lookups.calls.osuBeatmaps).toHaveLength(2);
  });

  it("doesn't ask osu! once the global budget is spent", async () => {
    const { id, expiresAt } = osuBudgetWindow(Date.now());
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertOne({ _id: id, count: OSU_API_BUDGET.limit, expiresAt });

    expect((await lookupStatsMeta([9])).size).toBe(0);
    expect(lookups.calls.osuBeatmaps).toEqual([]);
  });

  it("gives up quietly when osu! fails", async () => {
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
