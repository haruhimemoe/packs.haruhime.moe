/**
 * @file src/services/pack-stats.ts
 * @desc Pack stats in the database. After a save, refreshPackStats computes one
 *       pack's stats; the daily cron and the admin button run runPackStatsJob, which repairs
 *       missing or incomplete stats a batch at a time: packs with no stats first, then incomplete
 *       ones that are due for a retry, oldest first; in each group, listed public and unlisted
 *       packs before private and hidden ones. The haruhime pools account's packs due for a
 *       retry come after every other pack, and only in a run that took no other pack, so an
 *       import's backlog never delays anyone else's pack or spends its osu! allowance. Incomplete
 *       stats wait longer before each retry (statsRetryAt), so packs that keep failing can't
 *       crowd out the rest. Writes never move updatedAt and only land while the pack is unchanged
 *       since it was read, so a newer save always wins. Nothing here throws into a save: failures
 *       are logged and leave the stats missing for the job.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { QueryFilter, Types } from "mongoose";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import { POOLS_ACCOUNT } from "@/constants/pools";
import type { StarPair } from "@/constants/star-ratings";
import { connectDb } from "@/lib/db";
import { afterResponse, lookupModRatings, lookupStatsMeta } from "@/lib/pack-stats";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import { getPackModel } from "@/models/Pack";
import { type Pool, poolSchema } from "@/schemas/pack";
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
const NO_STATS = { stats: null };
/** Incomplete stats whose retry time has come (stats written before retryAt existed count too). */
const dueForRetry = (now: Date) => ({
  "stats.complete": false,
  "stats.retryAt": { $not: { $gt: now } },
});
/** Incomplete stats still waiting for their retry time. */
const waitingForRetry = (now: Date) => ({
  "stats.complete": false,
  "stats.retryAt": { $gt: now },
});
/** Packs /packs and share links show: public or unlisted, and not hidden by a moderator. */
const SHARED = { visibility: { $in: ["public", "unlisted"] }, hiddenAt: null };
/** Everything else: private packs, and packs a moderator hid. */
const NOT_SHARED = { $or: [{ visibility: "private" }, { hiddenAt: { $ne: null } }] };
/** The haruhime pools account's packs: an import adds hundreds at once. */
const POOLS_OWNED = { ownerId: POOLS_ACCOUNT.id };
/** Everyone else's packs. */
const NOT_POOLS = { ownerId: { $ne: POOLS_ACCOUNT.id } };
const OLDEST_PACK_FIRST = { _id: 1 } as const;
const OLDEST_STATS_FIRST = { "stats.computedAt": 1, _id: 1 } as const;
const FIELDS = {
  slug: 1,
  name: 1,
  slots: 1,
  buckets: 1,
  visibility: 1,
  hiddenAt: 1,
  updatedAt: 1,
  "stats.complete": 1,
  "stats.attempts": 1,
};

type StatsDoc = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  slots: unknown;
  buckets?: unknown;
  visibility: string;
  hiddenAt?: Date | null;
  updatedAt: Date;
  /** Only what the retry bookkeeping needs from the stats it replaces. */
  stats?: { complete?: boolean; attempts?: number } | null;
};

/** Stats as written: incomplete ones also carry the retry bookkeeping (never sent). */
type StoredStats = PackStatsRecord & { attempts?: number; retryAt?: Date };

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

const connectedModel = async () => {
  await connectDb();
  return getPackModel();
};

/** The pack's pool as validated data, or null for a corrupt document (skipped and logged). */
const poolOf = (doc: StatsDoc): Pool | null => {
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
 * One batch: metadata for every map at once, then every rating pair at once (so the job spends at
 * most one getStarRatings allowance), then each pack's stats.
 */
const computeBatch = async (
  docs: readonly StatsDoc[],
  {
    subject,
    lookupMeta = (ids) => lookupStatsMeta(ids, { subject }),
    lookupRatings = (pairs) => lookupModRatings(pairs, { subject }),
    now = () => new Date(),
  }: StatsDeps,
): Promise<{ doc: StatsDoc; stats: PackStatsRecord }[]> => {
  const pools = docs.flatMap((doc) => {
    const pool = poolOf(doc);
    return pool ? [{ doc, pool }] : [];
  });
  if (pools.length === 0) return [];
  const meta = await lookupMeta(pools.flatMap(({ pool }) => pool.slots.map((s) => s.beatmapId)));
  const pairs = new Map<string, StarPair>();
  for (const { pool } of pools) {
    for (const pair of statsPairsFor(pool.slots, pool.buckets, meta)) pairs.set(pair.key, pair);
  }
  const ratings = await lookupRatings([...pairs.values()]);
  const at = now();
  return pools.map(({ doc, pool }) => ({
    doc,
    stats: computeStats(pool.slots, pool.buckets, meta, ratings, at),
  }));
};

/**
 * The stats to store: complete ones as they are; incomplete ones with how many computations in a
 * row came out incomplete (stats from before this bookkeeping count as one) and when to retry.
 */
const withRetry = (stats: PackStatsRecord, previous: StatsDoc["stats"]): StoredStats => {
  if (stats.complete) return stats;
  const attempts = previous?.complete === false ? (previous.attempts ?? 1) + 1 : 1;
  return { ...stats, attempts, retryAt: statsRetryAt(stats.computedAt, attempts) };
};

/** Stores the stats if the pack is still as it was read. Returns whether it landed. */
const writeStats = async (
  model: Awaited<ReturnType<typeof connectedModel>>,
  doc: StatsDoc,
  stats: PackStatsRecord,
): Promise<boolean> => {
  const result = await model.updateOne(
    { _id: doc._id, updatedAt: doc.updatedAt },
    { $set: { stats: withRetry(stats, doc.stats) } },
    { timestamps: false },
  );
  return result.matchedCount === 1;
};

/** Pages that show these packs are stale now. */
const revalidateFor = (docs: readonly StatsDoc[]): void => {
  for (const doc of docs) revalidatePack(doc.slug);
  if (docs.some((doc) => doc.visibility === "public" && !doc.hiddenAt)) revalidatePublicPacks();
};

/**
 * @function refreshPackStats
 * @param slug {string} the pack
 * @param deps {StatsDeps} the caller's subject, lookups and clock (tests)
 * @returns {Promise<boolean>} true when new stats were stored; false when the pack is gone, was
 *          saved again meanwhile (that save schedules its own), or anything failed (logged).
 *          Never rejects.
 */
export const refreshPackStats = async (slug: string, deps: StatsDeps = {}): Promise<boolean> => {
  try {
    const model = await connectedModel();
    const doc = await model.findOne({ slug }, FIELDS).lean<StatsDoc>();
    if (!doc) return false;
    const [computed] = await computeBatch([doc], deps);
    if (!computed || !(await writeStats(model, doc, computed.stats))) return false;
    revalidateFor([doc]);
    return true;
  } catch (error) {
    console.error(`[stats] pack ${slug} failed:`, error);
    return false;
  }
};

/**
 * @function schedulePackStats
 * @param slug {string} a pack just saved
 * @param subject {string | undefined} the saver's rate-limit subject
 * @returns {void} computes the pack's stats after the response is sent (never during it)
 */
export const schedulePackStats = (slug: string, subject: string | undefined): void => {
  afterResponse(async () => {
    await refreshPackStats(slug, { subject });
  });
};

/**
 * @function countPacksNeedingStats
 * @param now {Date} the time to judge retries by (default: now)
 * @returns {Promise<number>} packs of any visibility the job would take: no stats, or incomplete
 *          ones due for a retry
 */
export const countPacksNeedingStats = async (now: Date = new Date()): Promise<number> =>
  (await connectedModel()).countDocuments({ $or: [NO_STATS, dueForRetry(now)] });

/**
 * @function runPackStatsJob
 * @param options {StatsDeps & { limit?: number }} packs per run (default PACK_STATS_JOB_LIMIT),
 *        lookups and clock (tests)
 * @returns {Promise<PackStatsJobResult>} how many packs got new stats; how many the next run
 *          would still take (no stats, or incomplete ones due for a retry, packs just recomputed
 *          included); and how many incomplete ones wait for a later retry
 * @throws when the database can't be reached (the route answers 500; nothing was written)
 */
export const runPackStatsJob = async ({
  limit = PACK_STATS_JOB_LIMIT,
  ...deps
}: StatsDeps & { limit?: number } = {}): Promise<PackStatsJobResult> => {
  const model = await connectedModel();
  const at = (deps.now ?? (() => new Date()))();
  const groups: { filter: QueryFilter<unknown>; sort: Record<string, 1>; last?: true }[] = [
    { filter: { ...NO_STATS, ...SHARED }, sort: OLDEST_PACK_FIRST },
    { filter: { ...NO_STATS, ...NOT_SHARED }, sort: OLDEST_PACK_FIRST },
    { filter: { ...dueForRetry(at), ...SHARED, ...NOT_POOLS }, sort: OLDEST_STATS_FIRST },
    { filter: { ...dueForRetry(at), ...NOT_SHARED, ...NOT_POOLS }, sort: OLDEST_STATS_FIRST },
    // One group for the pools backlog, whatever its visibility: nothing about it shows anywhere.
    { filter: { ...dueForRetry(at), ...POOLS_OWNED }, sort: OLDEST_STATS_FIRST, last: true },
  ];
  const picked: StatsDoc[] = [];
  for (const { filter, sort, last } of groups) {
    if (picked.length >= limit) break;
    // The pools backlog gets only runs with nothing else to do: a batch spends one osu!
    // allowance, which its pairs would otherwise take from another pack's.
    if (last && picked.length > 0) break;
    picked.push(
      ...(await model
        .find(filter, FIELDS)
        .sort(sort)
        .limit(limit - picked.length)
        .lean<StatsDoc[]>()),
    );
  }
  const written: StatsDoc[] = [];
  for (const { doc, stats } of await computeBatch(picked, deps)) {
    if (await writeStats(model, doc, stats)) written.push(doc);
  }
  if (written.length > 0) revalidateFor(written);
  return {
    updated: written.length,
    remaining: await countPacksNeedingStats(at),
    waiting: await model.countDocuments(waitingForRetry(at)),
  };
};
