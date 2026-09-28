/**
 * @file src/lib/osu/attributes.ts
 * @desc Star ratings with mods from the osu! API, for GET /api/osu/star-ratings and the stats
 *       job. Answers from the star_ratings cache first (30-day TTL; a pair osu! wouldn't rate is
 *       remembered for an hour and not asked about again); fetches up to 20 misses per request
 *       (a random 20, so viewers of one new pool don't all ask for the same ones), 4 at a time;
 *       and takes the osu! budget (src/lib/osu/budget.ts) before every call. Once the budget says
 *       no, the rest of the request stops asking it. Whatever it can't answer now is "pending"
 *       and the browser asks again. Never throws.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { OsuApiError, type OsuClient } from "@haruhimemoe/osu";
import "server-only";
import type { Db } from "mongodb";
import {
  MAX_OSU_FETCHES_PER_REQUEST,
  NULL_RATING_TTL_MS,
  OSU_FETCH_CONCURRENCY,
  STAR_RATINGS_COLLECTION,
  type StarPair,
} from "@/constants/star-ratings";
import { connectedDb } from "@/lib/db";
import { takeOsuBudget } from "@/lib/osu/budget";
import { getOsuClient } from "@/lib/osu/client";
import { shuffled } from "@/utils/shuffle";
import { runPool } from "@/utils/task-pool";

/**
 * A cached rating, or (nullUntil, no stars) a pair osu! wouldn't rate. A refusal leaves `stars`
 * out rather than writing `stars: null`: builds before the refusal cache read every row's `stars`
 * as a rating, so a rollback would serve null ratings and count them as 0 stars in pack stats.
 */
type StarDoc = { _id: string; stars?: number; fetchedAt: Date; nullUntil?: Date };

export type StarRatingsResult = { ratings: Record<string, number>; pending: string[] };

type LookupDeps = {
  osu?: Pick<OsuClient, "getStarRating">;
  db?: () => Promise<Db>;
  now?: () => number;
  random?: () => number;
  /** The caller's budget subject (next-kit's rateLimitSubject); omitted, only the global count. */
  subject?: string;
  /** Told the key of each pair osu! is asked about (the budget let that call through). */
  onAsk?: (key: string) => void;
};

/**
 * @function getStarRatings
 * @param pairs {readonly StarPair[]} validated, unique (beatmap, mods) pairs
 * @param deps {LookupDeps} osu! client, database, clock, random source (tests), and the
 *        caller's rate-limit subject and onAsk
 * @returns {Promise<StarRatingsResult>} ratings found or fetched, and the pairs to ask about again
 *          (request order). Pairs osu! refuses are in neither. Never rejects.
 */
export const getStarRatings = async (
  pairs: readonly StarPair[],
  {
    osu = getOsuClient(),
    db = connectedDb,
    now = Date.now,
    random = Math.random,
    subject,
    onAsk,
  }: LookupDeps = {},
): Promise<StarRatingsResult> => {
  const ratings: Record<string, number> = {};
  const pending = new Set<string>();
  const done = () => ({
    ratings,
    pending: pairs.map((p) => p.key).filter((key) => pending.has(key)),
  });

  let database: Db;
  try {
    database = await db();
  } catch (error) {
    // No database, no budget count: never call osu! blind.
    console.error("[osu] star ratings: database unavailable:", error);
    for (const pair of pairs) pending.add(pair.key);
    return done();
  }
  const cache = database.collection<StarDoc>(STAR_RATINGS_COLLECTION);
  const refusedByOsu = new Set<string>();

  try {
    const hits = await cache.find({ _id: { $in: pairs.map((p) => p.key) } }).toArray();
    for (const hit of hits) {
      if (typeof hit.stars === "number") ratings[hit._id] = hit.stars;
      // osu! wouldn't rate it within the hour: answer as it did then, without asking again.
      else if (hit.nullUntil && hit.nullUntil.getTime() > now()) refusedByOsu.add(hit._id);
    }
  } catch (error) {
    console.error("[osu] star ratings: cache read failed:", error);
  }

  const misses = shuffled(
    pairs.filter((pair) => ratings[pair.key] === undefined && !refusedByOsu.has(pair.key)),
    random,
  );
  for (const pair of misses.slice(MAX_OSU_FETCHES_PER_REQUEST)) pending.add(pair.key);

  // After the first "no", every later pair waits for the browser's next ask: counting it would
  // only push the counter further past the limit.
  let refused = false;
  await runPool(
    misses.slice(0, MAX_OSU_FETCHES_PER_REQUEST),
    OSU_FETCH_CONCURRENCY,
    async (pair) => {
      if (refused) {
        pending.add(pair.key);
        return;
      }
      try {
        const stars = await osu.getStarRating(pair.beatmapId, pair.set, {
          beforeCall: async () => {
            const granted = await takeOsuBudget(subject, now());
            if (granted) onAsk?.(pair.key);
            return granted;
          },
        });
        // osu! has no such map, or won't rate these mods: the slot keeps its rating without mods,
        // and the pair isn't asked about again for an hour, so a bad pair can't drain the budget.
        if (stars !== null) ratings[pair.key] = stars;
        const fetchedAt = new Date(now());
        await cache
          .updateOne(
            { _id: pair.key },
            stars === null
              ? {
                  $set: {
                    fetchedAt,
                    nullUntil: new Date(fetchedAt.getTime() + NULL_RATING_TTL_MS),
                  },
                  $unset: { stars: "" },
                }
              : { $set: { stars, fetchedAt }, $unset: { nullUntil: "" } },
            { upsert: true },
          )
          .catch((error: unknown) =>
            console.error("[osu] star ratings: cache write failed:", error),
          );
      } catch (error) {
        pending.add(pair.key);
        // The budget said no: this pair and every later one wait for the browser's next ask.
        if (error instanceof OsuApiError && error.code === "budget") {
          refused = true;
          return;
        }
        console.error(`[osu] star rating ${pair.key} failed:`, error);
      }
    },
  );

  return done();
};
