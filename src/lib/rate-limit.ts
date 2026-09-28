/**
 * @file src/lib/rate-limit.ts
 * @desc Fixed-window rate limits for packs' routes: @haruhimemoe/next-kit's limiter on the shared
 *       `rate_limits` collection (a TTL index removes spent counters). Counting fails open and
 *       logs; the request's own database work fails on its own if the database is really gone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { createRateLimiter } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { connectedDb } from "@/lib/db";

/**
 * hit, refuseOverLimit and deleteSubject over the rate_limits collection. The clock is read on
 * each call (not captured at import), so tests with fake timers count in their own minute.
 */
export const limiter = createRateLimiter({ db: connectedDb, now: () => Date.now() });

/** The counters keyed by a user's id (not an IP), which account deletion removes. */
export const USER_RATE_LIMITS = [RATE_LIMITS.api, RATE_LIMITS.apiWrite, RATE_LIMITS.keyCreate];

/**
 * @function deleteRateLimitsFor
 * @param userId {string} a user's id
 * @returns {Promise<number>} how many of that user's counters were deleted (the subject is
 *          escaped, so it can't widen the match to another user or scope)
 */
export const deleteRateLimitsFor = (userId: string): Promise<number> =>
  limiter.deleteSubject(USER_RATE_LIMITS, userId);
