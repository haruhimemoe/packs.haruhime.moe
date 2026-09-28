/**
 * @file src/services/pools-stats-backfill.ts
 * @desc runPoolsStatsBackfill, the batch pools.haruhime.moe asks for after a sync
 *       (POST /api/service/pools/stats): the pools account's packs with missing or incomplete
 *       stats, retry times ignored, on the pools-sync share of the osu! budget. It writes each
 *       rating pair osu! didn't rate to pools_backfill (24-hour TTL), so it never asks osu! twice
 *       in a day about one, and counts as updated only packs whose stats learned something, so
 *       the importer's stop after 5 idle calls works.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import {
  POOLS_BACKFILL_COLLECTION,
  POOLS_BACKFILL_WINDOW_MS,
  POOLS_SYNC_SUBJECT,
} from "@/constants/pools";
import type { StarPair } from "@/constants/star-ratings";
import { connectedDb } from "@/lib/db";
import { lookupModRatings, lookupStatsMeta } from "@/lib/pack-stats";
import { connectedPackModel } from "@/services/pack-records";
import {
  computeBatch,
  FIELDS,
  NO_STATS,
  OLDEST_STATS_FIRST,
  POOLS_OWNED,
  revalidateFor,
  type StatsDeps,
  type StatsDoc,
  writeStats,
} from "@/services/stats-batch";
import type { ModRatings, PackStatsRecord } from "@/utils/saved-pack-stats";

/** A rating pair the pools backfill asked osu! about that didn't come back rated. */
type BackfillPair = { _id: string; outcome: "unrated" | "failed"; expiresAt: Date };

export type PoolsBackfillResult = { updated: number; remaining: number };

/**
 * The pools account's packs a backfill still has work for: no stats, or incomplete ones it hasn't
 * run out of rating pairs to try for in the last POOLS_BACKFILL_WINDOW_MS. Retry times don't
 * count.
 */
const backfillQueue = (at: Date) => ({
  ...POOLS_OWNED,
  $or: [
    NO_STATS,
    {
      "stats.complete": false,
      "stats.backfilledAt": { $not: { $gt: new Date(at.getTime() - POOLS_BACKFILL_WINDOW_MS) } },
    },
  ],
});

/**
 * Ratings for backfill batches. A pair asked about earlier in this backfill isn't asked again: one
 * osu! wouldn't rate counts without mods (null), one that failed stays missing. The rest go to
 * lookupModRatings on the pools-sync share; each pair osu! was asked about and didn't rate is
 * written down until POOLS_BACKFILL_WINDOW_MS has passed. `failed` holds every pair that failed
 * in this backfill, earlier batches included.
 */
const backfillRatings = (at: Date, clockMs: () => number) => {
  const failed = new Set<string>();
  const lookup = async (pairs: readonly StarPair[]): Promise<ModRatings> => {
    const ledger = (await connectedDb()).collection<BackfillPair>(POOLS_BACKFILL_COLLECTION);
    const known = await ledger
      .find({ _id: { $in: pairs.map((pair) => pair.key) }, expiresAt: { $gt: at } })
      .toArray();
    const outcomes = new Map(known.map((row) => [row._id, row.outcome] as const));
    const fresh = pairs.filter((pair) => !outcomes.has(pair.key));
    const asked = new Set<string>();
    const ratings = new Map(
      await lookupModRatings(fresh, {
        subject: POOLS_SYNC_SUBJECT,
        now: clockMs,
        onAsk: (key) => asked.add(key),
      }),
    );
    for (const [key, outcome] of outcomes) {
      if (outcome === "unrated") ratings.set(key, null);
      else failed.add(key);
    }
    const expiresAt = new Date(at.getTime() + POOLS_BACKFILL_WINDOW_MS);
    const writes = fresh.flatMap(({ key }) => {
      // A number is in the star_ratings cache now; a pair nobody asked (the per-request cap, the
      // budget) waits for the next batch.
      const rating = ratings.get(key);
      if (!asked.has(key) || typeof rating === "number") return [];
      const outcome = rating === null ? ("unrated" as const) : ("failed" as const);
      if (outcome === "failed") failed.add(key);
      return [
        {
          updateOne: {
            filter: { _id: key },
            update: { $set: { outcome, expiresAt } },
            upsert: true,
          },
        },
      ];
    });
    if (writes.length > 0) await ledger.bulkWrite(writes);
    return ratings;
  };
  return { lookup, failed };
};

/**
 * Whether a backfill's stats know more than the ones they replace: the first stats, complete
 * ones, or fewer rating pairs and maps missing. Stats another writer stored (a save, the daily
 * job) carry no count, so the first backfill pass over them counts once.
 */
const gained = (previous: StatsDoc["stats"], stats: PackStatsRecord, missing: number): boolean =>
  !previous || stats.complete || previous.missing === undefined || missing < previous.missing;

/**
 * @function runPoolsStatsBackfill
 * @param options {StatsDeps & { limit?: number }} packs per batch (default PACK_STATS_JOB_LIMIT),
 *        lookups and clock (tests; the clock also picks the osu! budget's minute)
 * @returns {Promise<PoolsBackfillResult>} how many of the pools account's packs got stats that
 *          learned something (a rewrite that only moves computedAt or backfilledAt doesn't count),
 *          and how many still have work: no stats yet, rating pairs this backfill hasn't tried, or
 *          maps with no details yet (their pairs aren't known, so none were tried)
 * @throws when the database can't be reached (the route answers 500)
 */
export const runPoolsStatsBackfill = async ({
  limit = PACK_STATS_JOB_LIMIT,
  now = () => new Date(),
  lookupMeta,
  lookupRatings,
}: StatsDeps & { limit?: number } = {}): Promise<PoolsBackfillResult> => {
  const model = await connectedPackModel();
  const at = now();
  const clockMs = () => now().getTime();
  const docs = await model
    .find(backfillQueue(at), FIELDS)
    .sort(OLDEST_STATS_FIRST)
    .limit(limit)
    .lean<StatsDoc[]>();
  const ratings = backfillRatings(at, clockMs);
  const computed = await computeBatch(docs, {
    subject: POOLS_SYNC_SUBJECT,
    lookupMeta:
      lookupMeta ?? ((ids) => lookupStatsMeta(ids, { subject: POOLS_SYNC_SUBJECT, now: clockMs })),
    lookupRatings: lookupRatings ?? ratings.lookup,
    now,
  });
  const written: StatsDoc[] = [];
  let updated = 0;
  for (const { doc, stats, missingPairs, missing } of computed) {
    // Every map had details (a map without them hides its pairs, none of them tried yet) and
    // every pair it still lacks already failed in this backfill: nothing left to try for now.
    const exhausted =
      !stats.complete &&
      missing === missingPairs.length &&
      missingPairs.every((key) => ratings.failed.has(key));
    const landed = await writeStats(model, doc, stats, {
      countAttempt: false,
      missing,
      ...(exhausted ? { backfilledAt: at } : {}),
    });
    if (!landed) continue;
    written.push(doc);
    // The importer stops after 5 calls in a row with nothing updated: only progress counts.
    if (gained(doc.stats, stats, missing)) updated += 1;
  }
  if (written.length > 0) revalidateFor(written);
  return { updated, remaining: await model.countDocuments(backfillQueue(at)) };
};
