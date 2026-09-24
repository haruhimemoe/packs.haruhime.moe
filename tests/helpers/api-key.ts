/**
 * @file tests/helpers/api-key.ts
 * @desc API test helpers: a real key for a test user, Bearer headers, pre-filled rate-limit
 *       counters for the current window, and a frozen clock (Date only, so driver timers run).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { vi } from "vitest";
import type { RateLimitRule } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { connectedDb } from "@/lib/db";
import { rateLimitId } from "@/lib/rate-limit";
import { createApiKey } from "@/services/api-keys";

/** 10 s into a minute, so RateLimit-Reset is 50. */
export const FROZEN_AT = "2026-09-22T12:00:10.000Z";

/**
 * @function createTestApiKey
 * @param userId {string} a test user's id
 * @returns {Promise<string>} a working key for that user
 */
export const createTestApiKey = async (userId: string): Promise<string> =>
  (await createApiKey(userId)).key;

/**
 * @function bearer
 * @param key {string} token to send
 * @param extra {Record<string, string>} more headers (x-real-ip, ...)
 * @returns {Record<string, string>} headers for apiRequest
 */
export const bearer = (
  key: string,
  extra: Record<string, string> = {},
): Record<string, string> => ({
  authorization: `Bearer ${key}`,
  ...extra,
});

/**
 * @function seedRateLimit
 * @param rule {RateLimitRule} the limit
 * @param subject {string} user id or IP
 * @param count {number} hits already counted in the current window
 * @returns {Promise<void>}
 */
export const seedRateLimit = async (
  rule: RateLimitRule,
  subject: string,
  count: number,
): Promise<void> => {
  const db = await connectedDb();
  const now = Date.now();
  await db
    .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
    .updateOne(
      { _id: rateLimitId(rule, subject, now) },
      { $set: { count, expiresAt: new Date(now + 5 * 60_000) } },
      { upsert: true },
    );
};

/**
 * @function freezeTime
 * @param iso {string} the frozen time (default FROZEN_AT)
 * @returns {void} fakes Date only; undo with vi.useRealTimers()
 */
export const freezeTime = (iso: string = FROZEN_AT): void => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};
