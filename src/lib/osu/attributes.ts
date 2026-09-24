/**
 * @file src/lib/osu/attributes.ts
 * @desc Star ratings with mods from the osu! API, for GET /api/osu/star-ratings. Answers from the
 *       star_ratings cache first (30-day TTL); fetches up to 20 misses per request (a random 20,
 *       so viewers of one new pool don't all ask for the same ones), 4 at a time; and checks a
 *       global fixed-window budget in rate_limits before every osu! call, so all function
 *       instances together stay under 50 calls a minute. With a subject (the caller's IP, IPv6 by
 *       its /64), that subject's share (20 a minute, shared with /api/osu/beatmaps) is checked
 *       first, so one caller can't spend the budget for everyone. Once the budget says no, the rest of the
 *       request stops asking it. Whatever it can't answer now is "pending" and the browser asks
 *       again. Never throws.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import type { Db } from "mongodb";
import {
  MAX_OSU_FETCHES_PER_REQUEST,
  OSU_API_BUDGET,
  OSU_API_BUDGET_PER_IP,
  OSU_FETCH_CONCURRENCY,
  RATE_LIMITS_COLLECTION,
  STAR_RATINGS_COLLECTION,
  type StarPair,
} from "@/constants/star-ratings";
import { connectedDb } from "@/lib/db";
import { getOsuClient, OsuApiError, type OsuClient } from "@/lib/osu";
import { shuffled } from "@/utils/shuffle";
import { runPool } from "@/utils/task-pool";

/** Counters outlive their window by a minute, like qol-5's src/lib/rate-limit.ts. */
const BUDGET_GRACE_MS = 60_000;

type StarDoc = { _id: string; stars: number; fetchedAt: Date };
type CounterDoc = { _id: string; count: number; expiresAt: Date };

export type StarRatingsResult = { ratings: Record<string, number>; pending: string[] };

type LookupDeps = {
  osu?: Pick<OsuClient, "getStarRating">;
  db?: () => Promise<Db>;
  now?: () => number;
  random?: () => number;
  /** The caller's rate-limit subject (src/utils/client-ip.ts); omitted, only the global budget counts. */
  subject?: string;
};

/**
 * @function osuBudgetWindow
 * @param nowMs {number} current time (ms)
 * @returns {{ id: string; expiresAt: Date }} "osu-api:global:{windowStartSeconds}" and when the
 *          counter may be deleted (window end plus a minute)
 */
export const osuBudgetWindow = (nowMs: number): { id: string; expiresAt: Date } => {
  const size = OSU_API_BUDGET.windowSeconds * 1000;
  const start = Math.floor(nowMs / size) * size;
  return {
    id: `${OSU_API_BUDGET.scope}:${OSU_API_BUDGET.subject}:${start / 1000}`,
    expiresAt: new Date(start + size + BUDGET_GRACE_MS),
  };
};

/**
 * @function osuSubjectWindow
 * @param subject {string} a rate-limit subject (IPv4 address or IPv6 /64)
 * @param nowMs {number} current time (ms)
 * @returns {{ id: string; expiresAt: Date }} "osu-api-ip:{subject}:{windowStartSeconds}" and when
 *          the counter may be deleted (window end plus a minute)
 */
export const osuSubjectWindow = (
  subject: string,
  nowMs: number,
): { id: string; expiresAt: Date } => {
  const size = OSU_API_BUDGET_PER_IP.windowSeconds * 1000;
  const start = Math.floor(nowMs / size) * size;
  return {
    id: `${OSU_API_BUDGET_PER_IP.scope}:${subject}:${start / 1000}`,
    expiresAt: new Date(start + size + BUDGET_GRACE_MS),
  };
};

/**
 * @function bump
 * @param db {Db} the packs database
 * @param window {{ id: string; expiresAt: Date }} the counter document
 * @returns {Promise<number>} the count after this call (Infinity when the write returned nothing)
 */
const bump = async (db: Db, { id, expiresAt }: { id: string; expiresAt: Date }) => {
  const counter = await db
    .collection<CounterDoc>(RATE_LIMITS_COLLECTION)
    .findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" },
    );
  return counter?.count ?? Number.POSITIVE_INFINITY;
};

/**
 * @function takeOsuBudget
 * @param db {Db} the packs database
 * @param nowMs {number} current time (ms)
 * @param subject {string | undefined} the caller's rate-limit subject; when given, its share is
 *        counted first, and a subject past its share never touches the global counter
 * @returns {Promise<boolean>} true when this call fits in the subject's share and the current
 *          minute's global budget
 * @throws when a counter can't be written (callers treat that as "no budget")
 */
export const takeOsuBudget = async (db: Db, nowMs: number, subject?: string): Promise<boolean> => {
  if (
    subject !== undefined &&
    (await bump(db, osuSubjectWindow(subject, nowMs))) > OSU_API_BUDGET_PER_IP.limit
  ) {
    return false;
  }
  return (await bump(db, osuBudgetWindow(nowMs))) <= OSU_API_BUDGET.limit;
};

/**
 * @function getStarRatings
 * @param pairs {readonly StarPair[]} validated, unique (beatmap, mods) pairs
 * @param deps {LookupDeps} osu! client, database, clock, random source (tests), and the
 *        caller's rate-limit subject
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

  try {
    const hits = await cache.find({ _id: { $in: pairs.map((p) => p.key) } }).toArray();
    for (const hit of hits) ratings[hit._id] = hit.stars;
  } catch (error) {
    console.error("[osu] star ratings: cache read failed:", error);
  }

  const misses = shuffled(
    pairs.filter((pair) => ratings[pair.key] === undefined),
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
          beforeCall: () => takeOsuBudget(database, now(), subject),
        });
        // osu! has no such map, or won't rate these mods: the slot keeps its rating without mods.
        if (stars === null) return;
        ratings[pair.key] = stars;
        await cache
          .updateOne(
            { _id: pair.key },
            { $set: { stars, fetchedAt: new Date(now()) } },
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
