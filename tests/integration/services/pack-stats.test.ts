/**
 * @file tests/integration/services/pack-stats.test.ts
 * @desc Pack stats in the database: one pack's stats from the mirror, osu! for maps the mirror
 *       lacks and ratings with mods, stored without moving updatedAt; failing lookups store
 *       incomplete stats; a map osu! says is gone doesn't; a save in between wins; revalidation.
 *       The repair job: missing stats first (public and unlisted, then private and hidden), then
 *       incomplete ones that are due, oldest first; a longer wait before each retry; the cap; what
 *       is due and what waits; one star-rating allowance per run; the haruhime pools account's packs
 *       retried last, only in runs with nothing else due; with no pools packs, the job runs as
 *       before and makes no account. The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { MAX_OSU_FETCHES_PER_REQUEST } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
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

describe("runPackStatsJob and the pools account's packs", () => {
  it("retries other packs before the pools account's, and never in the same run", async () => {
    const owner = await createTestUser();
    onMirror(lookups, beatmapRow(101));
    // An import adds many pools packs at once, before another pack's stats fail.
    const imported: string[] = [];
    for (let n = 1; n <= 3; n++) {
      imported.push(
        await packWith(POOLS_ACCOUNT.id, `Pool ${n}`, "public", {
          complete: false,
          computedAt: "2026-09-01T00:00:00Z",
        }),
      );
    }
    const community = await packWith(owner.id, "Community", "public", {
      complete: false,
      computedAt: "2026-09-20T00:00:00Z",
    });

    // The other pack goes first, and alone: it keeps the run's whole osu! allowance.
    expect(await runPackStatsJob({ limit: 25, now: () => NOW })).toEqual({
      updated: 1,
      remaining: 3,
      waiting: 0,
    });
    expect((await storedStats(community))?.complete).toBe(true);
    for (const slug of imported) expect((await storedStats(slug))?.complete).toBe(false);

    // With nothing else due, the pools backlog gets the run.
    expect(await runPackStatsJob({ limit: 2, now: () => NOW })).toEqual({
      updated: 2,
      remaining: 1,
      waiting: 0,
    });
    expect((await storedStats(imported[0] ?? ""))?.complete).toBe(true);
  });

  it("fills in a pools pack with no stats at all like any other pack", async () => {
    const owner = await createTestUser();
    onMirror(lookups, beatmapRow(101));
    const imported = await packWith(POOLS_ACCOUNT.id, "Pool", "public");
    const community = await packWith(owner.id, "Community", "public", {
      complete: false,
      computedAt: "2026-09-20T00:00:00Z",
    });

    expect(await runPackStatsJob({ limit: 1, now: () => NOW })).toMatchObject({ updated: 1 });
    expect((await storedStats(imported))?.complete).toBe(true);
    expect((await storedStats(community))?.complete).toBe(false);
  });

  it("runs as before, and makes no account, while pools has published nothing", async () => {
    const owner = await createTestUser();
    onMirror(lookups, beatmapRow(101));
    const olderRetry = await packWith(owner.id, "Retry old", "public", {
      complete: false,
      computedAt: "2026-09-01T00:00:00Z",
    });
    const newerRetry = await packWith(owner.id, "Retry newer", "private", {
      complete: false,
      computedAt: "2026-09-20T00:00:00Z",
    });
    const missing = await packWith(owner.id, "Missing", "private");

    // No stats first, then due retries, shared before private; the empty pools group ends nothing.
    expect(await runPackStatsJob({ limit: 1, now: () => NOW })).toEqual({
      updated: 1,
      remaining: 2,
      waiting: 0,
    });
    expect((await storedStats(missing))?.complete).toBe(true);
    expect(await runPackStatsJob({ limit: 1, now: () => NOW })).toEqual({
      updated: 1,
      remaining: 1,
      waiting: 0,
    });
    expect((await storedStats(olderRetry))?.complete).toBe(true);
    expect(await runPackStatsJob({ now: () => NOW })).toEqual({
      updated: 1,
      remaining: 0,
      waiting: 0,
    });
    expect((await storedStats(newerRetry))?.complete).toBe(true);
    // Only the test user: the job never creates the pools account.
    expect(await getDb().collection("user").countDocuments({})).toBe(1);
  });
});

describe("runPackStatsJob", () => {
  it("fills in missing stats first (public and unlisted, then private), then retries incomplete ones, oldest first", async () => {
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
      waiting: 0,
    });
    expect((await storedStats(missing))?.computedAt).toEqual(NOW);
    // A private pack with no stats at all goes before any pack that only needs a retry.
    expect((await storedStats(privateMissing))?.complete).toBe(true);
    expect((await storedStats(olderIncomplete))?.complete).toBe(false);

    expect(await runPackStatsJob({ limit: 1, now: () => NOW })).toEqual({
      updated: 1,
      remaining: 1,
      waiting: 0,
    });
    expect((await storedStats(olderIncomplete))?.complete).toBe(true);
    expect((await storedStats(newerIncomplete))?.complete).toBe(false);

    expect(await runPackStatsJob({ now: () => NOW })).toEqual({
      updated: 1,
      remaining: 0,
      waiting: 0,
    });
    expect((await storedStats(newerIncomplete))?.complete).toBe(true);
    // Complete stats are never redone.
    expect((await storedStats(complete))?.computedAt).toEqual(new Date("2026-02-01T00:00:00Z"));
  });

  it("puts packs a moderator hid with the private ones", async () => {
    const owner = await createTestUser();
    onMirror(lookups, beatmapRow(101));
    const hidden = await packWith(owner.id, "Hidden", "public");
    await getPackModel().updateOne(
      { slug: hidden },
      { $set: { hiddenAt: new Date("2026-09-01T00:00:00Z") } },
      { timestamps: false },
    );
    const shown = await packWith(owner.id, "Shown", "public");

    await runPackStatsJob({ limit: 1, now: () => NOW });

    expect(await storedStats(shown)).not.toBeNull();
    expect(await storedStats(hidden)).toBeNull();
  });

  it("waits longer before each retry of stats that stay incomplete", async () => {
    const owner = await createTestUser();
    lookups.mirrorDown = true;
    lookups.osuDown = true;
    const slug = await packWith(owner.id, "Unlucky", "public");
    const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

    // Never computed: done now, and incomplete. The next run may retry it at once.
    expect(await runPackStatsJob({ now: () => NOW })).toEqual({
      updated: 1,
      remaining: 1,
      waiting: 0,
    });
    // Second try, still incomplete: it waits 23 hours.
    expect(await runPackStatsJob({ now: () => NOW })).toEqual({
      updated: 1,
      remaining: 0,
      waiting: 1,
    });
    expect(await runPackStatsJob({ now: () => at(22) })).toEqual({
      updated: 0,
      remaining: 0,
      waiting: 1,
    });
    expect(await runPackStatsJob({ now: () => at(23) })).toMatchObject({ updated: 1 });
    // Third try: 47 hours.
    expect(await runPackStatsJob({ now: () => at(23 + 46) })).toMatchObject({ updated: 0 });
    expect(await runPackStatsJob({ now: () => at(23 + 47) })).toMatchObject({ updated: 1 });

    // Once the lookups work again, the stats are complete and the pack leaves the queue.
    lookups.mirrorDown = false;
    lookups.osuDown = false;
    onMirror(lookups, beatmapRow(101));
    const later = at(23 + 47 + 95);
    expect(await runPackStatsJob({ now: () => later })).toEqual({
      updated: 1,
      remaining: 0,
      waiting: 0,
    });
    expect((await storedStats(slug))?.complete).toBe(true);
  });

  it("keeps the retry bookkeeping out of the pack the site and the API send", async () => {
    const owner = await createTestUser();
    lookups.mirrorDown = true;
    lookups.osuDown = true;
    const slug = await packWith(owner.id, "Unlucky", "public");
    await runPackStatsJob({ now: () => NOW });

    const pack = (await getPackForViewer(slug, null))?.pack;
    expect(pack?.stats?.complete).toBe(false);
    expect(Object.keys(pack?.stats ?? {})).not.toContain("attempts");
    expect(Object.keys(pack?.stats ?? {})).not.toContain("retryAt");
  });

  it("reaches a private pack with no stats while many public packs can't complete", async () => {
    const owner = await createTestUser();
    lookups.mirrorDown = true;
    lookups.osuDown = true;
    for (let i = 0; i < PACK_STATS_JOB_LIMIT + 1; i++) {
      await packWith(owner.id, `Stuck ${i}`, "public", {
        complete: false,
        computedAt: "2026-01-01T00:00:00Z",
      });
    }
    const privateMissing = await packWith(owner.id, "Private", "private");

    const first = await runPackStatsJob({ now: () => NOW });

    expect(first.updated).toBe(PACK_STATS_JOB_LIMIT);
    expect(await storedStats(privateMissing)).not.toBeNull();
    // The two public packs it didn't reach, and the private one's first retry.
    expect(first).toMatchObject({ remaining: 3, waiting: PACK_STATS_JOB_LIMIT - 1 });

    // The next run clears what's due, and then nothing is due until the retries' wait is over.
    expect(await runPackStatsJob({ now: () => NOW })).toEqual({
      updated: 3,
      remaining: 0,
      waiting: PACK_STATS_JOB_LIMIT + 2,
    });
    expect(await runPackStatsJob({ now: () => NOW })).toMatchObject({ updated: 0 });
  });

  it("does nothing, and asks nobody, when every pack has complete stats", async () => {
    expect(await runPackStatsJob()).toEqual({ updated: 0, remaining: 0, waiting: 0 });
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
    expect(result.remaining).toBe(await countPacksNeedingStats(NOW));
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
