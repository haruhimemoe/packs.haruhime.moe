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
 *       are logged and leave the stats missing for the job. runPoolsStatsBackfill is the batch
 *       pools.haruhime.moe asks for after a sync: its packs only, retry times ignored, on the
 *       pools-sync share of the osu! budget, and it never asks osu! twice in a day about a pair
 *       that didn't come back rated. It counts as updated only packs whose stats learned
 *       something, so the importer's stop after 5 idle calls works.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { QueryFilter, Types } from "mongoose";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import {
  POOLS_ACCOUNT,
  POOLS_BACKFILL_COLLECTION,
  POOLS_BACKFILL_WINDOW_MS,
  POOLS_SYNC_SUBJECT,
} from "@/constants/pools";
import type { StarPair } from "@/constants/star-ratings";
import { connectDb, connectedDb } from "@/lib/db";
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
  "stats.missing": 1,
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
  /** Only what the retry bookkeeping and the backfill's progress check need from the stats it replaces. */
  stats?: { complete?: boolean; attempts?: number; missing?: number } | null;
};

/**
 * Stats as written: incomplete ones also carry the retry bookkeeping and, from a pools backfill,
 * when it ran out of rating pairs to try for the pack and how many rating pairs and maps the
 * stats still lack (never sent).
 */
type StoredStats = PackStatsRecord & {
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
 * A pack's new stats; the keys of the rating pairs it needed that didn't come back; and how much
 * the stats still lack: those pairs, plus slots whose map has no details yet (a map with no
 * details has no pairs to count).
 */
type Computed = { doc: StatsDoc; stats: PackStatsRecord; missingPairs: string[]; missing: number };

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
 * The stats to store: complete ones as they are; incomplete ones with how many computations in a
 * row came out incomplete (stats from before this bookkeeping count as one) and when to retry. A
 * pools backfill pass isn't a failed retry: it keeps the count it found (at least one), so the
 * daily job's backoff starts where it was.
 */
const withRetry = (
  stats: PackStatsRecord,
  previous: StatsDoc["stats"],
  countAttempt = true,
): StoredStats => {
  if (stats.complete) return stats;
  const before = previous?.complete === false ? (previous.attempts ?? 1) : 0;
  const attempts = countAttempt ? before + 1 : Math.max(1, before);
  return { ...stats, attempts, retryAt: statsRetryAt(stats.computedAt, attempts) };
};

type WriteOptions = {
  /** False for a pools backfill pass (see withRetry). */
  countAttempt?: boolean;
  /** When a pools backfill ran out of rating pairs to try for this pack. */
  backfilledAt?: Date;
  /** Rating pairs and maps incomplete stats still lack (a pools backfill's progress check). */
  missing?: number;
};

/** Stores the stats if the pack is still as it was read. Returns whether it landed. */
const writeStats = async (
  model: Awaited<ReturnType<typeof connectedModel>>,
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
  const model = await connectedModel();
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
