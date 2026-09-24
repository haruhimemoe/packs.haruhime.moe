/**
 * @file src/lib/rate-limit.ts
 * @desc Fixed-window rate limits in MongoDB (collection rate_limits): one document per
 *       scope/subject/window, bumped with a single findOneAndUpdate upsert $inc, removed by the
 *       TTL index on expiresAt a minute after its window ends. The collection, the document shape
 *       and the TTL index (created by connectDb's ensureIndexes) are shared with qol-3's global
 *       osu! budget (src/lib/osu/attributes.ts, `osu-api:global:*`). Counting fails open: if the
 *       write fails, the request is allowed and the error logged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { RATE_LIMITS, type RateLimitRule } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { jsonError } from "@/lib/api";
import { connectedDb } from "@/lib/db";

/**
 * MongoDB's TTL monitor runs about once a minute; the grace keeps a live window's counter.
 * Same grace as the osu! budget in src/lib/osu/attributes.ts.
 */
const GRACE_MS = 60_000;

type Counter = { _id: string; count: number; expiresAt: Date };

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
};

/**
 * @function windowFor
 * @param rule {RateLimitRule} the limit
 * @param nowMs {number} current time (ms)
 * @returns {{ start: number; end: number; resetSeconds: number; expiresAt: Date }} the window
 *          holding nowMs; resetSeconds is 1 to windowSeconds
 */
export const windowFor = (rule: RateLimitRule, nowMs: number) => {
  const size = rule.windowSeconds * 1000;
  const start = Math.floor(nowMs / size) * size;
  const end = start + size;
  return {
    start,
    end,
    resetSeconds: Math.ceil((end - nowMs) / 1000),
    expiresAt: new Date(end + GRACE_MS),
  };
};

/**
 * @function rateLimitId
 * @param rule {RateLimitRule} the limit
 * @param subject {string} user id or IP
 * @param nowMs {number} current time (ms)
 * @returns {string} "{scope}:{subject}:{windowStartSeconds}"
 */
export const rateLimitId = (rule: RateLimitRule, subject: string, nowMs: number): string =>
  `${rule.scope}:${subject}:${windowFor(rule, nowMs).start / 1000}`;

/** No createIndex here: connectDb() already ensures the { expiresAt: 1 } TTL index. */
const counters = async () => (await connectedDb()).collection<Counter>(RATE_LIMITS_COLLECTION);

/**
 * @function hitRateLimit
 * @param rule {RateLimitRule} the limit
 * @param subject {string} user id or IP
 * @param now {Date} current time (tests)
 * @returns {Promise<RateLimitResult>} this hit counted; allowed while count <= limit. When
 *          counting fails, allowed with the full limit remaining.
 */
export const hitRateLimit = async (
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date(),
): Promise<RateLimitResult> => {
  const window = windowFor(rule, now.getTime());
  const base = { limit: rule.limit, resetSeconds: window.resetSeconds };
  try {
    const collection = await counters();
    const bump = () =>
      collection.findOneAndUpdate(
        { _id: rateLimitId(rule, subject, now.getTime()) },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: window.expiresAt } },
        { upsert: true, returnDocument: "after" },
      );
    // Two first hits in a window can race to insert; the loser's retry finds the document.
    const doc = await bump().catch((error: unknown) => {
      if (!isDuplicateKey(error)) throw error;
      return bump();
    });
    const count = doc?.count ?? 1;
    return { ...base, allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count) };
  } catch (error) {
    // The request's own database work fails on its own if the database is really gone.
    console.error(`rate limit: couldn't count ${rule.scope}`, error);
    return { ...base, allowed: true, remaining: rule.limit };
  }
};

/**
 * @function rateLimitHeaders
 * @param result {RateLimitResult} a counted hit
 * @returns {Record<string, string>} RateLimit-Limit/Remaining/Reset, plus Retry-After when refused
 */
export const rateLimitHeaders = (result: RateLimitResult): Record<string, string> => ({
  "RateLimit-Limit": String(result.limit),
  "RateLimit-Remaining": String(result.remaining),
  "RateLimit-Reset": String(result.resetSeconds),
  ...(result.allowed ? {} : { "Retry-After": String(result.resetSeconds) }),
});

/**
 * @function withHeaders
 * @param response {Response} a response with mutable headers (Response.json / new Response)
 * @param headers {Record<string, string>} headers to set
 * @returns {Response} the same response
 */
export const withHeaders = (response: Response, headers: Record<string, string>): Response => {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
};

/**
 * @function retryText
 * @param seconds {number} wait time
 * @returns {string} "45 seconds", "1 minute", "30 minutes"
 */
export const retryText = (seconds: number): string => {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

/**
 * @function tooManyRequests
 * @param result {RateLimitResult} a refused hit
 * @returns {Response} 429 rate_limited with every rate-limit header
 */
export const tooManyRequests = (result: RateLimitResult): Response =>
  withHeaders(
    jsonError(429, `Too many requests. Try again in ${retryText(result.resetSeconds)}.`),
    rateLimitHeaders(result),
  );

/**
 * @function refuseOverLimit
 * @param rule {RateLimitRule} the limit
 * @param subject {string} user id or IP
 * @returns {Promise<Response | null>} counts this hit; a 429 (Retry-After, no-store) when it's
 *          over the limit, otherwise null and the route carries on
 */
export const refuseOverLimit = async (
  rule: RateLimitRule,
  subject: string,
): Promise<Response | null> => {
  const result = await hitRateLimit(rule, subject);
  if (result.allowed) return null;
  return withHeaders(tooManyRequests(result), { "Cache-Control": "no-store" });
};

const OBJECT_ID_HEX = /^[0-9a-f]{24}$/;

const USER_SCOPES = [RATE_LIMITS.api, RATE_LIMITS.apiWrite, RATE_LIMITS.keyCreate].map(
  (rule) => rule.scope,
);

/**
 * @function deleteRateLimitsFor
 * @param userId {string} a user id (ObjectId hex)
 * @returns {Promise<void>} removes that user's per-user counters (account deletion); the
 *          anchored pattern never matches `osu-api:global:*` or `auth-fail:*`. Rejects anything
 *          but 24 lowercase hex characters, so the id can't widen the pattern.
 */
export const deleteRateLimitsFor = async (userId: string): Promise<void> => {
  if (!OBJECT_ID_HEX.test(userId)) throw new Error("deleteRateLimitsFor: not a user id");
  await (await counters()).deleteMany({
    _id: { $regex: `^(${USER_SCOPES.join("|")}):${userId}:` },
  });
};
