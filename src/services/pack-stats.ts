/**
 * @file src/services/pack-stats.ts
 * @desc Pack stats in the database (filters spec). After a save, refreshPackStats computes one
 *       pack's stats; the daily cron and the admin button run runPackStatsJob, which repairs
 *       missing or incomplete stats a batch at a time (public and unlisted packs first, then
 *       private; never-computed first, then the oldest). Writes never move updatedAt and only land
 *       while the pack is unchanged since it was read, so a newer save always wins. Nothing here
 *       throws into a save: failures are logged and leave the stats missing for the job.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Types } from "mongoose";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
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
  type StatsMeta,
  statsPairsFor,
} from "@/utils/saved-pack-stats";
import { storedBuckets } from "@/utils/stored-buckets";

/** Packs whose stats are missing (or null) or incomplete. */
const NEEDS_STATS = { $or: [{ stats: null }, { "stats.complete": false }] };
/** Never computed first (a missing field sorts first), then the oldest, then the oldest pack. */
const OLDEST_STATS_FIRST = { "stats.computedAt": 1, _id: 1 } as const;
const FIELDS = { slug: 1, name: 1, slots: 1, buckets: 1, visibility: 1, hiddenAt: 1, updatedAt: 1 };

type StatsDoc = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  slots: unknown;
  buckets?: unknown;
  visibility: string;
  hiddenAt?: Date | null;
  updatedAt: Date;
};

export type StatsDeps = {
  /** The caller's rate-limit subject (a save); omitted for the job. */
  subject?: string | undefined;
  /** Metadata source (default: mirror, then osu!). */
  lookupMeta?: (ids: readonly number[]) => Promise<ReadonlyMap<number, StatsMeta>>;
  /** Ratings with mods (default: the star_ratings cache, then osu!). */
  lookupRatings?: (pairs: readonly StarPair[]) => Promise<ModRatings>;
  now?: () => Date;
};

export type PackStatsJobResult = { updated: number; remaining: number };

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

/** Stores the stats if the pack is still as it was read. Returns whether it landed. */
const writeStats = async (
  model: Awaited<ReturnType<typeof connectedModel>>,
  doc: StatsDoc,
  stats: PackStatsRecord,
): Promise<boolean> => {
  const result = await model.updateOne(
    { _id: doc._id, updatedAt: doc.updatedAt },
    { $set: { stats } },
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
 * @returns {Promise<number>} packs of any visibility with missing or incomplete stats
 */
export const countPacksNeedingStats = async (): Promise<number> =>
  (await connectedModel()).countDocuments(NEEDS_STATS);

/**
 * @function runPackStatsJob
 * @param options {StatsDeps & { limit?: number }} packs per run (default PACK_STATS_JOB_LIMIT),
 *        lookups and clock (tests)
 * @returns {Promise<PackStatsJobResult>} how many packs got new stats, and how many still have
 *          missing or incomplete ones (packs just recomputed but still incomplete count too)
 * @throws when the database can't be reached (the route answers 500; nothing was written)
 */
export const runPackStatsJob = async ({
  limit = PACK_STATS_JOB_LIMIT,
  ...deps
}: StatsDeps & { limit?: number } = {}): Promise<PackStatsJobResult> => {
  const model = await connectedModel();
  const shared = await model
    .find({ ...NEEDS_STATS, visibility: { $in: ["public", "unlisted"] } }, FIELDS)
    .sort(OLDEST_STATS_FIRST)
    .limit(limit)
    .lean<StatsDoc[]>();
  const own =
    shared.length < limit
      ? await model
          .find({ ...NEEDS_STATS, visibility: "private" }, FIELDS)
          .sort(OLDEST_STATS_FIRST)
          .limit(limit - shared.length)
          .lean<StatsDoc[]>()
      : [];
  const written: StatsDoc[] = [];
  for (const { doc, stats } of await computeBatch([...shared, ...own], deps)) {
    if (await writeStats(model, doc, stats)) written.push(doc);
  }
  if (written.length > 0) revalidateFor(written);
  return { updated: written.length, remaining: await countPacksNeedingStats() };
};
