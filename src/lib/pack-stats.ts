/**
 * @file src/lib/pack-stats.ts
 * @desc Server plumbing for pack stats (filters spec): run work after the response (Next's
 *       after()), beatmap metadata from the hinai mirror (JSON only, 100 ids a call, never .osz)
 *       with osu! for the ids the mirror lacks, and ratings with mods from the star_ratings cache
 *       and osu! (getStarRatings). Every osu! call spends the shared budget, and the caller's
 *       share of it when a subject is given. Lookups never throw: what they can't get is missing,
 *       and a map osu! says doesn't exist comes back as null.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { createHinaiClient, HINAI_BATCH_LIMIT, type HinaiClient } from "@haruhimemoe/hinai";
import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import type { Db } from "mongodb";
import { after } from "next/server";
import { MAX_OSU_METADATA_CALLS, MIRROR_LOOKUP_CONCURRENCY } from "@/constants/pack-stats";
import { SERVER_USER_AGENT } from "@/constants/site";
import type { StarPair } from "@/constants/star-ratings";
import { connectedDb } from "@/lib/db";
import { getOsuClient, type OsuClient } from "@/lib/osu";
import { getStarRatings, takeOsuBudget } from "@/lib/osu/attributes";
import type { ModRatings } from "@/utils/saved-pack-stats";
import { runPool } from "@/utils/task-pool";

let serverMirror: HinaiClient | undefined;

/** The mirror client for server calls: it says who we are, as the mirror asks. */
const getServerMirror = (): HinaiClient => {
  serverMirror ??= createHinaiClient({ userAgent: SERVER_USER_AGENT });
  return serverMirror;
};

/**
 * @function afterResponse
 * @param task {() => Promise<void>} work that must not slow the response down (it must not throw)
 * @returns {void} schedules it with Next's after(); outside a request (a script), skips it with a
 *          warning, since nothing would wait for it (the daily job covers what it would have done)
 */
export const afterResponse = (task: () => Promise<void>): void => {
  try {
    after(task);
  } catch (error) {
    console.warn(
      "[stats] not in a request, so nothing was scheduled:",
      error instanceof Error ? error.message : error,
    );
  }
};

type MetaDeps = {
  mirror?: Pick<HinaiClient, "getBeatmaps">;
  osu?: Pick<OsuClient, "getBeatmaps">;
  db?: () => Promise<Db>;
  now?: () => number;
  /** The caller's rate-limit subject; omitted (the daily job), only the global budget counts. */
  subject?: string | undefined;
  /** osu! calls this lookup may make at most (MAX_OSU_METADATA_CALLS). */
  maxOsuCalls?: number;
};

const chunks = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/**
 * @function lookupStatsMeta
 * @param ids {readonly number[]} beatmap ids (duplicates fine)
 * @param deps {MetaDeps} mirror and osu! clients, database, clock (tests), subject, osu! call cap
 * @returns {Promise<Map<number, BeatmapMeta | null>>} metadata for every id the mirror or osu!
 *          answered, and null for each id osu! says doesn't exist. Ids in a failed mirror call go
 *          to osu! too. osu! is asked only within the budget and the call cap; ids it couldn't
 *          check (refused, over the cap, a failed call) are absent. Never rejects.
 */
export const lookupStatsMeta = async (
  ids: readonly number[],
  {
    mirror = getServerMirror(),
    osu = getOsuClient(),
    db = connectedDb,
    now = Date.now,
    subject,
    maxOsuCalls = MAX_OSU_METADATA_CALLS,
  }: MetaDeps = {},
): Promise<Map<number, BeatmapMeta | null>> => {
  const found = new Map<number, BeatmapMeta | null>();
  const missing: number[] = [];
  await runPool(
    chunks([...new Set(ids)], HINAI_BATCH_LIMIT),
    MIRROR_LOOKUP_CONCURRENCY,
    async (batch) => {
      try {
        const result = await mirror.getBeatmaps(batch);
        for (const [id, meta] of result.found) found.set(id, meta);
        missing.push(...result.missing);
      } catch (error) {
        console.error("[stats] mirror lookup failed:", error);
        missing.push(...batch);
      }
    },
  );
  if (missing.length === 0 || maxOsuCalls <= 0) return found;

  // After the first "no" (or a failing counter), later batches stay unchecked without counting.
  let calls = 0;
  let refused = false;
  const beforeCall = async (): Promise<boolean> => {
    if (refused || calls >= maxOsuCalls) return false;
    try {
      refused = !(await takeOsuBudget(await db(), now(), subject));
    } catch (error) {
      console.error("[stats] osu! budget counter unavailable:", error);
      refused = true;
    }
    if (!refused) calls++;
    return !refused;
  };
  try {
    const result = await osu.getBeatmaps(
      missing.sort((a, b) => a - b),
      { beforeCall },
    );
    for (const [id, meta] of result.found) found.set(id, meta);
    // osu! answered no row: deleted or never there. Asking again won't change that.
    for (const id of result.missing) found.set(id, null);
  } catch (error) {
    console.error("[stats] osu! lookup failed:", error);
  }
  return found;
};

type RatingDeps = Parameters<typeof getStarRatings>[1];

/**
 * @function lookupModRatings
 * @param pairs {readonly StarPair[]} unique (beatmap, forced set) pairs
 * @param deps {RatingDeps} getStarRatings' dependencies (the subject among them)
 * @returns {Promise<ModRatings>} each pair's rating; null for a pair osu! won't rate (the slot
 *          counts without mods); pairs still pending (budget, errors, the per-request cap) absent.
 *          Never rejects.
 */
export const lookupModRatings = async (
  pairs: readonly StarPair[],
  deps: RatingDeps = {},
): Promise<ModRatings> => {
  if (pairs.length === 0) return new Map();
  const { ratings, pending } = await getStarRatings(pairs, deps);
  const waiting = new Set(pending);
  const out = new Map<string, number | null>();
  for (const { key } of pairs) {
    const stars = ratings[key];
    if (stars !== undefined) out.set(key, stars);
    else if (!waiting.has(key)) out.set(key, null);
  }
  return out;
};
