/**
 * @file tests/integration/services/pools-backfill.test.ts
 * @desc runPoolsStatsBackfill: only the pools account's packs, retry times ignored, the pools-sync
 *       share of the osu! budget. The importer's loop (one call a minute until `remaining` is 0 or
 *       5 calls in a row update nothing) reaches complete stats asking osu! about each pair once,
 *       stops when osu! keeps failing and leaves those packs to the daily job (a day later a new
 *       backfill tries again), never asks twice about a pair osu! won't rate, waits out a global
 *       budget visitors spent without marking anything tried, and keeps a pack in the queue while
 *       its maps have no details (none of its pairs were tried yet). `updated` counts only packs
 *       whose stats learned something, so while that budget stays spent the loop stops after 5
 *       calls. The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { POOLS_ACCOUNT, POOLS_BACKFILL_COLLECTION, POOLS_SYNC_SUBJECT } from "@/constants/pools";
import { OSU_API_BUDGET, RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { osuBudgetWindow, osuSubjectWindow } from "@/lib/osu/attributes";
import { getPackModel } from "@/models/Pack";
import type { PackInput } from "@/schemas/saved-pack";
import {
  countPacksNeedingStats,
  type PoolsBackfillResult,
  runPoolsStatsBackfill,
} from "@/services/pack-stats";
import { createPack, getPackForViewer } from "@/services/packs";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";
import { beatmapRow, onMirror, setupStatsLookups } from "../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

const START = new Date("2026-09-24T12:00:00.000Z");
const minute = (n: number) => new Date(START.getTime() + n * 60_000);

/** A pack of `count` DT slots on maps `first`, `first + 1`, ...: the mirror knows each map, and osu! rates each with DT (or refuses the ones listed). */
const dtPack = async (
  ownerId: string,
  name: string,
  first: number,
  count: number,
  refused: readonly number[] = [],
): Promise<string> => {
  const slots = Array.from({ length: count }, (_, i) => ({
    mod: "DT",
    index: i + 1,
    beatmapId: first + i,
  }));
  for (const { beatmapId } of slots) {
    onMirror(lookups, beatmapRow(beatmapId));
    lookups.ratings.set(`${beatmapId}:DT`, refused.includes(beatmapId) ? "refuse" : 6);
  }
  const input: PackInput = { name, slots, visibility: "public" };
  return (await createPack(ownerId, input, { unlimited: true })).slug;
};

const stats = async (slug: string) =>
  (await getPackModel().findOne({ slug }).lean())?.stats ?? null;

/** The importer's loop: a call a minute until nothing is left or 5 calls in a row update nothing. */
const backfillLoop = async (maxCalls = 20): Promise<PoolsBackfillResult[]> => {
  const results: PoolsBackfillResult[] = [];
  let idle = 0;
  for (let call = 0; call < maxCalls; call++) {
    const result = await runPoolsStatsBackfill({ now: () => minute(call) });
    results.push(result);
    idle = result.updated === 0 ? idle + 1 : 0;
    if (result.remaining === 0 || idle === 5) break;
  }
  return results;
};

describe("runPoolsStatsBackfill", () => {
  it("takes only the pools account's packs, ignores their retry time, and spends the pools-sync share", async () => {
    const owner = await createTestUser();
    const other = await dtPack(owner.id, "Someone's", 3000, 1);
    const pool = await dtPack(POOLS_ACCOUNT.id, "Pool", 3100, 1);
    // Incomplete, and waiting a week for the daily job's next retry.
    await getPackModel().updateOne(
      { slug: pool },
      {
        $set: {
          stats: {
            mods: ["DT"],
            modes: [],
            count: 1,
            complete: false,
            computedAt: START,
            attempts: 4,
            retryAt: new Date(START.getTime() + 7 * 86_400_000),
          },
        },
      },
      { timestamps: false },
    );

    expect(await runPoolsStatsBackfill({ now: () => START })).toEqual({ updated: 1, remaining: 0 });

    expect((await stats(pool))?.complete).toBe(true);
    expect(await stats(other)).toBeNull();
    const share = osuSubjectWindow(POOLS_SYNC_SUBJECT, START.getTime()).id;
    const counters = getDb().collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION);
    expect(await counters.findOne({ _id: share })).toMatchObject({ count: 1 });
  });

  it("reaches complete stats for every pools pack, asking osu! about each pair once", async () => {
    const slugs = [
      await dtPack(POOLS_ACCOUNT.id, "Pool A", 2000, 15),
      await dtPack(POOLS_ACCOUNT.id, "Pool B", 2100, 15),
      await dtPack(POOLS_ACCOUNT.id, "Pool C", 2200, 15),
    ];

    const results = await backfillLoop();

    // 45 pairs at 20 a minute: three calls (a pack can finish early, so only the end is fixed).
    expect(results).toHaveLength(3);
    expect(results.at(-1)?.remaining).toBe(0);
    for (const slug of slugs) expect((await stats(slug))?.complete).toBe(true);
    expect(lookups.calls.attributes).toHaveLength(45);
    expect(new Set(lookups.calls.attributes).size).toBe(45);
  });

  it("stops once every pair was tried when osu! keeps failing, and leaves the packs to the daily job", async () => {
    const slugs = [
      await dtPack(POOLS_ACCOUNT.id, "Pool A", 2000, 15),
      await dtPack(POOLS_ACCOUNT.id, "Pool B", 2100, 15),
      await dtPack(POOLS_ACCOUNT.id, "Pool C", 2200, 15),
    ];
    lookups.osuDown = true;

    const results = await backfillLoop();

    expect(results).toHaveLength(3);
    expect(results.at(-1)?.remaining).toBe(0);
    // Only the first stats count: a pair that failed teaches nothing.
    expect(results.map((result) => result.updated)).toEqual([3, 0, 0]);
    expect(lookups.calls.attributes).toHaveLength(45);
    expect(new Set(lookups.calls.attributes).size).toBe(45);
    for (const slug of slugs) {
      // Not counted as failed retries: due for the daily job at once, with its normal backoff.
      expect(await stats(slug)).toMatchObject({ complete: false, attempts: 1, missing: 15 });
      const sent = (await getPackForViewer(slug, null))?.pack.stats ?? {};
      expect(Object.keys(sent)).not.toContain("backfilledAt");
      expect(Object.keys(sent)).not.toContain("missing");
    }
    expect(await countPacksNeedingStats(minute(3))).toBe(3);

    // A day later, a new backfill tries them again (and, with osu! still down, learns nothing).
    const nextDay = new Date(START.getTime() + 25 * 3_600_000);
    expect(await runPoolsStatsBackfill({ now: () => nextDay })).toMatchObject({ updated: 0 });
    expect(lookups.calls.attributes).toHaveLength(65);
  });

  it("never asks twice about a pair osu! won't rate", async () => {
    const slug = await dtPack(POOLS_ACCOUNT.id, "Pool", 5000, 25, [5000, 5001]);

    const results = await backfillLoop();

    expect(results.at(-1)?.remaining).toBe(0);
    expect((await stats(slug))?.complete).toBe(true);
    expect(lookups.calls.attributes).toHaveLength(25);
    expect(new Set(lookups.calls.attributes).size).toBe(25);
  });

  it("waits out a global osu! budget visitors spent, without marking a pair as tried", async () => {
    const slug = await dtPack(POOLS_ACCOUNT.id, "Pool", 4000, 3);
    const window = osuBudgetWindow(START.getTime());
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertOne({ _id: window.id, count: OSU_API_BUDGET.limit, expiresAt: window.expiresAt });

    // The pack's first stats, incomplete, still count as progress.
    expect(await runPoolsStatsBackfill({ now: () => START })).toEqual({ updated: 1, remaining: 1 });
    expect(lookups.calls.attributes).toEqual([]);
    expect(await getDb().collection(POOLS_BACKFILL_COLLECTION).countDocuments({})).toBe(0);

    // The next minute has a fresh budget.
    expect(await runPoolsStatsBackfill({ now: () => minute(1) })).toEqual({
      updated: 1,
      remaining: 0,
    });
    expect((await stats(slug))?.complete).toBe(true);
  });

  it("keeps a pack whose maps have no details yet in the queue: none of its pairs were tried", async () => {
    const slug = await dtPack(POOLS_ACCOUNT.id, "Pool", 4000, 3);
    // The mirror is down and osu! knows the maps, but visitors spent its budget this minute.
    lookups.mirrorDown = true;
    for (const id of [4000, 4001, 4002]) lookups.osu.set(id, beatmapRow(id));
    const window = osuBudgetWindow(START.getTime());
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertOne({ _id: window.id, count: OSU_API_BUDGET.limit, expiresAt: window.expiresAt });

    expect(await runPoolsStatsBackfill({ now: () => START })).toEqual({ updated: 1, remaining: 1 });
    expect(lookups.calls.attributes).toEqual([]);
    const first = await stats(slug);
    expect(first).toMatchObject({ complete: false, missing: 3 });
    expect(first).not.toHaveProperty("backfilledAt");
    expect(await getDb().collection(POOLS_BACKFILL_COLLECTION).countDocuments({})).toBe(0);

    // The next minute has a fresh budget: osu! sends the details, then rates each pair.
    expect(await runPoolsStatsBackfill({ now: () => minute(1) })).toEqual({
      updated: 1,
      remaining: 0,
    });
    expect((await stats(slug))?.complete).toBe(true);
    expect([...lookups.calls.attributes].sort()).toEqual(["4000:DT", "4001:DT", "4002:DT"]);
  });

  it("stops after 5 calls in a row that learn nothing, while visitors keep the global osu! budget spent", async () => {
    const slug = await dtPack(POOLS_ACCOUNT.id, "Pool", 4000, 3);
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertMany(
        Array.from({ length: 20 }, (_, n) => {
          const window = osuBudgetWindow(minute(n).getTime());
          return { _id: window.id, count: OSU_API_BUDGET.limit, expiresAt: window.expiresAt };
        }),
      );

    const results = await backfillLoop();

    // The first call writes the pack's first stats; the next five only rewrite them.
    expect(results).toEqual([
      { updated: 1, remaining: 1 },
      ...Array.from({ length: 5 }, () => ({ updated: 0, remaining: 1 })),
    ]);
    expect(lookups.calls.attributes).toEqual([]);
    expect(await getDb().collection(POOLS_BACKFILL_COLLECTION).countDocuments({})).toBe(0);
    expect(await stats(slug)).toMatchObject({ complete: false, missing: 3 });
  });
});
