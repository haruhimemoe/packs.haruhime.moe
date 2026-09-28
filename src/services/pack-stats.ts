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
 *       are logged and leave the stats missing for the job. The batch pieces are in
 *       services/stats-batch.ts; the pools backfill is services/pools-stats-backfill.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { QueryFilter } from "mongoose";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import { afterResponse } from "@/lib/pack-stats";
import { connectedPackModel } from "@/services/pack-records";
import {
  computeBatch,
  dueForRetry,
  FIELDS,
  NO_STATS,
  NOT_POOLS,
  NOT_SHARED,
  OLDEST_PACK_FIRST,
  OLDEST_STATS_FIRST,
  type PackStatsJobResult,
  POOLS_OWNED,
  revalidateFor,
  SHARED,
  type StatsDeps,
  type StatsDoc,
  waitingForRetry,
  writeStats,
} from "@/services/stats-batch";

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
    const model = await connectedPackModel();
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
  (await connectedPackModel()).countDocuments({ $or: [NO_STATS, dueForRetry(now)] });

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
  const model = await connectedPackModel();
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
