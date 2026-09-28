/**
 * @file src/services/stats-batch.ts
 * @desc The pieces every stats run shares (runPackStatsJob and refreshPackStats in
 *       services/pack-stats.ts, runPoolsStatsBackfill in services/pools-stats-backfill.ts): which
 *       packs need stats, the fields a run reads, one batch's computation, retry bookkeeping, the
 *       write that only lands while the pack is unchanged, and marking pages stale.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Types } from "mongoose";
import { POOLS_ACCOUNT } from "@/constants/pools";
import type { StarPair } from "@/constants/star-ratings";
import { lookupModRatings, lookupStatsMeta } from "@/lib/pack-stats";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import { type Pool, poolSchema } from "@/schemas/pack";
import type { connectedPackModel } from "@/services/pack-records";
import {
  computeStats,
  type ModRatings,
  type PackStatsRecord,
  type StatsMetaById,
  statsPairsFor,
  statsRetryAt,
} from "@/utils/saved-pack-stats";
import { storedBuckets } from "@/utils/stored-buckets";

/** Packs with no stats (the field missing or null). */
export const NO_STATS = { stats: null };
/**
 * @function dueForRetry
 * @param now {Date} the run's time
 * @returns {object} the filter for incomplete stats whose retry time has come (stats written
 *          before retryAt existed count too)
 */
export const dueForRetry = (now: Date) => ({
  "stats.complete": false,
  "stats.retryAt": { $not: { $gt: now } },
});
/**
 * @function waitingForRetry
 * @param now {Date} the run's time
 * @returns {object} the filter for incomplete stats still waiting for their retry time
 */
export const waitingForRetry = (now: Date) => ({
  "stats.complete": false,
  "stats.retryAt": { $gt: now },
});
/** Packs /packs and share links show: public or unlisted, and not hidden by a moderator. */
export const SHARED = { visibility: { $in: ["public", "unlisted"] }, hiddenAt: null };
/** Everything else: private packs, and packs a moderator hid. */
export const NOT_SHARED = { $or: [{ visibility: "private" }, { hiddenAt: { $ne: null } }] };
/** The haruhime pools account's packs: an import adds hundreds at once. */
export const POOLS_OWNED = { ownerId: POOLS_ACCOUNT.id };
/** Everyone else's packs. */
export const NOT_POOLS = { ownerId: { $ne: POOLS_ACCOUNT.id } };
export const OLDEST_PACK_FIRST = { _id: 1 } as const;
export const OLDEST_STATS_FIRST = { "stats.computedAt": 1, _id: 1 } as const;
export const FIELDS = {
  slug: 1,
  name: 1,
  slots: 1,
  buckets: 1,
  visibility: 1,
  hiddenAt: 1,
  updatedAt: 1,
  "stats.complete": 1,
  "stats.attempts": 1,
  "stats.missing": 1,
};

export type StatsDoc = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  slots: unknown;
  buckets?: unknown;
  visibility: string;
  hiddenAt?: Date | null;
  updatedAt: Date;
  /** Only what the retry bookkeeping and the backfill's progress check need from the stats it replaces. */
  stats?: { complete?: boolean; attempts?: number; missing?: number } | null;
};

/**
 * Stats as written: incomplete ones also carry the retry bookkeeping and, from a pools backfill,
 * when it ran out of rating pairs to try for the pack and how many rating pairs and maps the
 * stats still lack (never sent).
 */
export type StoredStats = PackStatsRecord & {
  attempts?: number;
  retryAt?: Date;
  backfilledAt?: Date;
  missing?: number;
};

export type StatsDeps = {
  /** The caller's rate-limit subject (a save); omitted for the job. */
  subject?: string | undefined;
  /** Metadata source (default: mirror, then osu!); null for a map osu! says doesn't exist. */
  lookupMeta?: (ids: readonly number[]) => Promise<StatsMetaById>;
  /** Ratings with mods (default: the star_ratings cache, then osu!). */
  lookupRatings?: (pairs: readonly StarPair[]) => Promise<ModRatings>;
  now?: () => Date;
};

export type PackStatsJobResult = { updated: number; remaining: number; waiting: number };

/**
 * @function poolOf
 * @param doc {StatsDoc} a stored pack
 * @returns {Pool | null} its pool as validated data, or null for a corrupt document (skipped and
 *          logged)
 */
export const poolOf = (doc: StatsDoc): Pool | null => {
  const buckets = storedBuckets(doc.buckets);
  const parsed = poolSchema.safeParse({
    name: doc.name,
    slots: doc.slots,
    ...(buckets ? { buckets } : {}),
  });
  if (!parsed.success) console.error(`[stats] pack ${doc.slug} doesn't parse; skipped`);
  return parsed.success ? parsed.data : null;
};

/**
 * A pack's new stats; the keys of the rating pairs it needed that didn't come back; and how much
 * the stats still lack: those pairs, plus slots whose map has no details yet (a map with no
 * details has no pairs to count).
 */
export type Computed = {
  doc: StatsDoc;
  stats: PackStatsRecord;
  missingPairs: string[];
  missing: number;
};

/**
 * @function computeBatch
 * @param docs {readonly StatsDoc[]} the packs in this batch
 * @param deps {StatsDeps} lookups, clock and the osu! subject
 * @returns {Promise<Computed[]>} each valid pack's stats: metadata for every map at once, then
 *          every rating pair at once (so the job spends at most one getStarRatings allowance)
 */
export const computeBatch = async (
  docs: readonly StatsDoc[],
  {
    subject,
    lookupMeta = (ids) => lookupStatsMeta(ids, { subject }),
    lookupRatings = (pairs) => lookupModRatings(pairs, { subject }),
    now = () => new Date(),
  }: StatsDeps,
): Promise<Computed[]> => {
  const pools = docs.flatMap((doc) => {
    const pool = poolOf(doc);
    return pool ? [{ doc, pool }] : [];
  });
  if (pools.length === 0) return [];
  const meta = await lookupMeta(pools.flatMap(({ pool }) => pool.slots.map((s) => s.beatmapId)));
  const needs = pools.map((entry) => ({
    ...entry,
    pairs: statsPairsFor(entry.pool.slots, entry.pool.buckets, meta),
  }));
  const unique = new Map<string, StarPair>();
  for (const { pairs } of needs) for (const pair of pairs) unique.set(pair.key, pair);
  const ratings = await lookupRatings([...unique.values()]);
  const at = now();
  return needs.map(({ doc, pool, pairs }) => {
    const missingPairs = pairs.filter((pair) => !ratings.has(pair.key)).map((pair) => pair.key);
    const noDetails = pool.slots.filter((slot) => meta.get(slot.beatmapId) === undefined).length;
    return {
      doc,
      stats: computeStats(pool.slots, pool.buckets, meta, ratings, at),
      missingPairs,
      missing: missingPairs.length + noDetails,
    };
  });
};

/**
 * @function withRetry
 * @param stats {PackStatsRecord} freshly computed stats
 * @param previous {StatsDoc["stats"]} what the pack had
 * @param countAttempt {boolean} false for a pools backfill pass
 * @returns {StoredStats} the stats to store: complete ones as they are; incomplete ones with how
 *          many computations in a
 * row came out incomplete (stats from before this bookkeeping count as one) and when to retry. A
 * pools backfill pass isn't a failed retry: it keeps the count it found (at least one), so the
 * daily job's backoff starts where it was.
 */
export const withRetry = (
  stats: PackStatsRecord,
  previous: StatsDoc["stats"],
  countAttempt = true,
): StoredStats => {
  if (stats.complete) return stats;
  const before = previous?.complete === false ? (previous.attempts ?? 1) : 0;
  const attempts = countAttempt ? before + 1 : Math.max(1, before);
  return { ...stats, attempts, retryAt: statsRetryAt(stats.computedAt, attempts) };
};

export type WriteOptions = {
  /** False for a pools backfill pass (see withRetry). */
  countAttempt?: boolean;
  /** When a pools backfill ran out of rating pairs to try for this pack. */
  backfilledAt?: Date;
  /** Rating pairs and maps incomplete stats still lack (a pools backfill's progress check). */
  missing?: number;
};

/**
 * @function writeStats
 * @param model {PackModel} the connected pack model
 * @param doc {StatsDoc} the pack as it was read
 * @param stats {PackStatsRecord} its new stats
 * @param options {WriteOptions} retry bookkeeping and a backfill's progress
 * @returns {Promise<boolean>} whether the write landed (only while the pack is unchanged)
 */
export const writeStats = async (
  model: Awaited<ReturnType<typeof connectedPackModel>>,
  doc: StatsDoc,
  stats: PackStatsRecord,
  { countAttempt = true, backfilledAt, missing }: WriteOptions = {},
): Promise<boolean> => {
  const stored: StoredStats = {
    ...withRetry(stats, doc.stats, countAttempt),
    ...(backfilledAt ? { backfilledAt } : {}),
    ...(missing !== undefined && !stats.complete ? { missing } : {}),
  };
  const result = await model.updateOne(
    { _id: doc._id, updatedAt: doc.updatedAt },
    { $set: { stats: stored } },
    { timestamps: false },
  );
  return result.matchedCount === 1;
};

/**
 * @function revalidateFor
 * @param docs {readonly StatsDoc[]} packs whose stats changed
 * @returns {void} marks their pages (and the public lists, for a listed pack) stale
 */
export const revalidateFor = (docs: readonly StatsDoc[]): void => {
  for (const doc of docs) revalidatePack(doc.slug);
  if (docs.some((doc) => doc.visibility === "public" && !doc.hiddenAt)) revalidatePublicPacks();
};
