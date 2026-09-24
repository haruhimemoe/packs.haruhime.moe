/**
 * @file tests/integration/services/pack-stats.test.ts
 * @desc Pack stats in the database: one pack's stats from the mirror, osu! for maps the mirror
 *       lacks and ratings with mods, stored without moving updatedAt; failing lookups store
 *       incomplete stats; a save in between wins; revalidation. The repair job: public and
 *       unlisted first, then private; missing stats, then the oldest; the cap; what remains; one
 *       star-rating allowance per run. The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_OSU_FETCHES_PER_REQUEST } from "@/constants/star-ratings";
import { getPackModel } from "@/models/Pack";
import type { PackInput } from "@/schemas/saved-pack";
import { countPacksNeedingStats, refreshPackStats, runPackStatsJob } from "@/services/pack-stats";
import { createPack, getPackForViewer, updatePack } from "@/services/packs";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";
import { beatmapRow, onMirror, setupStatsLookups } from "../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

const NOW = new Date("2026-09-24T12:00:00.000Z");

const input = (overrides: Partial<PackInput> = {}): PackInput => ({
  name: "SPC Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 101 },
    { mod: "DT", index: 1, beatmapId: 102 },
  ],
  visibility: "public",
  ...overrides,
});

const storedStats = async (slug: string) =>
  (await getPackModel().findOne({ slug }).lean())?.stats ?? null;

beforeEach(() => vi.mocked(revalidatePath).mockClear());

describe("refreshPackStats", () => {
  it("stores stats from the mirror and osu!'s DT rating, without moving updatedAt", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input());
    onMirror(
      lookups,
      beatmapRow(101, { difficulty_rating: 4.5, total_length: 90, bpm: 150 }),
      beatmapRow(102, { difficulty_rating: 5, total_length: 150, bpm: 200 }),
    );
    lookups.ratings.set("102:DT", 7.25);

    expect(await refreshPackStats(pack.slug, { now: () => NOW })).toBe(true);

    const found = await getPackForViewer(pack.slug, null);
    expect(found?.pack.stats).toEqual({
      srMin: 4.5,
      srMax: 7.25,
      srAvg: 5.88,
      lenMin: 90,
      lenMax: 100,
      bpmMin: 150,
      bpmMax: 300,
      mods: ["NM", "DT"],
      modes: ["osu"],
      count: 2,
      complete: true,
      computedAt: NOW.toISOString(),
    });
    expect(found?.pack.updatedAt).toBe(pack.updatedAt);
    expect(lookups.calls.mirror).toEqual(["101,102"]);
    expect(lookups.calls.osuBeatmaps).toEqual([]);
    expect(lookups.calls.attributes).toEqual(["102:DT"]);
  });

  it("asks osu! for maps the mirror doesn't know", async () => {
    const owner = await createTestUser();
    const pack = await createPack(
      owner.id,
      input({ slots: [{ mod: "NM", index: 1, beatmapId: 7 }] }),
    );
    lookups.osu.set(7, beatmapRow(7, { difficulty_rating: 3.2, mode: "taiko" }));

    await refreshPackStats(pack.slug);

    expect(lookups.calls.osuBeatmaps).toEqual(["7"]);
    expect(await storedStats(pack.slug)).toMatchObject({
      srMin: 3.2,
      modes: ["taiko"],
      complete: true,
    });
  });

  it("stores complete stats without a map osu! says doesn't exist", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input());
    // 101 is on the mirror; 102 was deleted: the mirror lacks it and osu! answers no row.
    onMirror(lookups, beatmapRow(101, { difficulty_rating: 4.5 }));

    expect(await refreshPackStats(pack.slug, { now: () => NOW })).toBe(true);

    expect(lookups.calls.osuBeatmaps).toEqual(["102"]);
    expect(lookups.calls.attributes).toEqual([]);
    expect(await storedStats(pack.slug)).toMatchObject({
      srMin: 4.5,
      srMax: 4.5,
      mods: ["NM", "DT"],
      modes: ["osu"],
      count: 2,
      complete: true,
    });
    expect(await countPacksNeedingStats()).toBe(0);
  });

  it("stores incomplete stats when the mirror and osu! both fail", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input());
    lookups.mirrorDown = true;
    lookups.osuDown = true;

    expect(await refreshPackStats(pack.slug)).toBe(true);

    expect(await storedStats(pack.slug)).toMatchObject({
      srMin: null,
      lenMin: null,
      mods: ["NM", "DT"],
      modes: [],
      count: 2,
      complete: false,
    });
  });

  it("stores incomplete stats while a rating with mods can't be had", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input());
    onMirror(lookups, beatmapRow(101), beatmapRow(102));
    lookups.osuDown = true;

    await refreshPackStats(pack.slug);

    expect(await storedStats(pack.slug)).toMatchObject({ srMin: 5, srMax: 5, complete: false });
  });

  it("counts a slot osu! won't rate with its plain rating", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input());
    onMirror(lookups, beatmapRow(101, { difficulty_rating: 4 }), beatmapRow(102));
    lookups.ratings.set("102:DT", "refuse");

    await refreshPackStats(pack.slug);

    expect(await storedStats(pack.slug)).toMatchObject({ srMin: 4, srMax: 5, complete: true });
  });

  it("drops its result when the pack was saved again meanwhile", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input());
    const lookupMeta = async () => {
      // The owner saves while the lookup runs.
      await new Promise((resolve) => setTimeout(resolve, 5));
      await updatePack(pack.slug, owner.id, input({ name: "Renamed" }));
      return new Map<number, null>();
    };

    expect(await refreshPackStats(pack.slug, { lookupMeta })).toBe(false);
    expect(await storedStats(pack.slug)).toBeNull();
  });

  it("is false for a pack that's gone", async () => {
    expect(await refreshPackStats("AAAAAAAAAA")).toBe(false);
  });

  it("marks /packs and the pack page stale for a public pack", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input());
    vi.mocked(revalidatePath).mockClear();
    onMirror(lookups, beatmapRow(101), beatmapRow(102));

    await refreshPackStats(pack.slug);

    expect(revalidatePath).toHaveBeenCalledWith(`/p/${pack.slug}`);
    expect(revalidatePath).toHaveBeenCalledWith("/packs/index.json");
  });

  it("marks only the pack page stale for a private pack", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, input({ visibility: "private" }));
    vi.mocked(revalidatePath).mockClear();

    await refreshPackStats(pack.slug);

    expect(vi.mocked(revalidatePath).mock.calls).toEqual([[`/p/${pack.slug}`]]);
  });
});

/** A pack with the given stats state: none, or incomplete/complete computed at a date. */
const packWith = async (
  ownerId: string,
  name: string,
  visibility: PackInput["visibility"],
  stats?: { complete: boolean; computedAt: string },
) => {
  const pack = await createPack(
    ownerId,
    input({ name, visibility, slots: [{ mod: "NM", index: 1, beatmapId: 101 }] }),
  );
  if (stats) {
    await getPackModel().updateOne(
      { slug: pack.slug },
      {
        $set: {
          stats: {
            mods: ["NM"],
            modes: [],
            count: 1,
            ...stats,
            computedAt: new Date(stats.computedAt),
          },
        },
      },
      { timestamps: false },
    );
  }
  return pack.slug;
};

describe("runPackStatsJob", () => {
  it("repairs public and unlisted packs first: missing stats, then the oldest", async () => {
    const owner = await createTestUser();
    onMirror(lookups, beatmapRow(101));
    const olderIncomplete = await packWith(owner.id, "Unlisted old", "unlisted", {
      complete: false,
      computedAt: "2026-01-01T00:00:00Z",
    });
    const newerIncomplete = await packWith(owner.id, "Public newer", "public", {
      complete: false,
      computedAt: "2026-06-01T00:00:00Z",
    });
    const missing = await packWith(owner.id, "Public missing", "public");
    const privateMissing = await packWith(owner.id, "Private missing", "private");
    const complete = await packWith(owner.id, "Done", "public", {
      complete: true,
      computedAt: "2026-02-01T00:00:00Z",
    });

    expect(await runPackStatsJob({ limit: 2, now: () => NOW })).toEqual({
      updated: 2,
      remaining: 2,
    });
    expect((await storedStats(missing))?.computedAt).toEqual(NOW);
    expect((await storedStats(olderIncomplete))?.computedAt).toEqual(NOW);
    expect((await storedStats(newerIncomplete))?.complete).toBe(false);
    expect(await storedStats(privateMissing)).toBeNull();

    // Public before private, even when the private pack has no stats at all.
    expect(await runPackStatsJob({ limit: 1, now: () => NOW })).toEqual({
      updated: 1,
      remaining: 1,
    });
    expect((await storedStats(newerIncomplete))?.complete).toBe(true);
    expect(await storedStats(privateMissing)).toBeNull();

    expect(await runPackStatsJob({ now: () => NOW })).toEqual({ updated: 1, remaining: 0 });
    expect((await storedStats(privateMissing))?.complete).toBe(true);
    // Complete stats are never redone.
    expect((await storedStats(complete))?.computedAt).toEqual(new Date("2026-02-01T00:00:00Z"));
  });

  it("does nothing, and asks nobody, when every pack has complete stats", async () => {
    expect(await runPackStatsJob()).toEqual({ updated: 0, remaining: 0 });
    expect(lookups.calls.mirror).toEqual([]);
  });

  it("looks every map up at once and stays within one star-rating allowance", async () => {
    const owner = await createTestUser();
    const slugs: string[] = [];
    for (let pack = 0; pack < 3; pack++) {
      const slots = Array.from({ length: 10 }, (_, i) => ({
        mod: "DT",
        index: i + 1,
        beatmapId: 1000 + pack * 10 + i,
      }));
      for (const { beatmapId } of slots) {
        onMirror(lookups, beatmapRow(beatmapId));
        lookups.ratings.set(`${beatmapId}:DT`, 6);
      }
      slugs.push((await createPack(owner.id, input({ name: `Pack ${pack}`, slots }))).slug);
    }

    const result = await runPackStatsJob({ now: () => NOW });

    expect(result.updated).toBe(3);
    expect(lookups.calls.mirror).toHaveLength(1);
    expect(lookups.calls.attributes).toHaveLength(MAX_OSU_FETCHES_PER_REQUEST);
    // 30 pairs, 20 rated: at least one pack is still incomplete and stays in the queue.
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.remaining).toBe(await countPacksNeedingStats());
    // The next run finishes them from the cache and osu!.
    expect(await runPackStatsJob({ now: () => NOW })).toMatchObject({ remaining: 0 });
    for (const slug of slugs) expect((await storedStats(slug))?.srAvg).toBe(6);
  });

  it("revalidates the public list once when it updated a public pack", async () => {
    const owner = await createTestUser();
    onMirror(lookups, beatmapRow(101));
    await packWith(owner.id, "One", "public");
    await packWith(owner.id, "Two", "public");
    vi.mocked(revalidatePath).mockClear();

    await runPackStatsJob();

    const indexCalls = vi
      .mocked(revalidatePath)
      .mock.calls.filter(([path]) => path === "/packs/index.json");
    expect(indexCalls).toHaveLength(1);
  });
});
