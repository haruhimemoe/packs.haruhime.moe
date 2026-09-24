/**
 * @file src/lib/db-indexes.ts
 * @desc Indexes on collections Mongoose doesn't manage (better-auth's). The session TTL index makes
 *       MongoDB delete a sign-in session about a minute after it expires, which the privacy policy
 *       promises. Also the 30-day TTL on cached star ratings, and the TTL on rate-limit counters (the
 *       rate_limits collection src/lib/rate-limit.ts and the osu! budget share). createIndex is a
 *       no-op when the index already exists.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Db } from "mongodb";
import {
  RATE_LIMITS_COLLECTION,
  STAR_RATINGS_COLLECTION,
  STAR_RATINGS_TTL_INDEX,
  STAR_RATINGS_TTL_SECONDS,
} from "@/constants/star-ratings";

export const SESSION_TTL_INDEX = "session_expiresAt_ttl";

/**
 * @function ensureIndexes
 * @param db {Db} the packs database
 * @returns {Promise<void>} resolves even when an index can't be created (logged, never thrown):
 *          a missing TTL index must not take the site down
 */
export const ensureIndexes = async (db: Db): Promise<void> => {
  try {
    await Promise.all([
      db
        .collection("session")
        .createIndex({ expiresAt: 1 }, { name: SESSION_TTL_INDEX, expireAfterSeconds: 0 }),
      db
        .collection(STAR_RATINGS_COLLECTION)
        .createIndex(
          { fetchedAt: 1 },
          { name: STAR_RATINGS_TTL_INDEX, expireAfterSeconds: STAR_RATINGS_TTL_SECONDS },
        ),
      // Default name. src/lib/rate-limit.ts creates no index of its own and relies on this one.
      db
        .collection(RATE_LIMITS_COLLECTION)
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
  } catch (error) {
    console.error("db: couldn't create indexes", error);
  }
};
