/**
 * @file tests/helpers/api-key.ts
 * @desc API test helpers: a real key for a test user, who a key acts as (through the /api/v1
 *       guard, the only place a key is looked up), Bearer headers, pre-filled rate-limit
 *       counters for the current window, and a frozen clock (Date only, so driver timers run).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Sun Oct 4, 2026
 */

import { rateLimitId } from "@haruhimemoe/next-kit/server";
import { vi } from "vitest";
import type { RateLimitRule } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { withApiKey } from "@/lib/api-auth";
import { connectedDb } from "@/lib/db";
import { type ApiCaller, createApiKey } from "@/services/api-keys";

/** 10 s into a minute, so RateLimit-Reset is 50. */
export const FROZEN_AT = "2026-09-22T12:00:10.000Z";

/**
 * @function createTestApiKey
 * @param userId {string} a test user's id
 * @returns {Promise<string>} a working key for that user
 */
export const createTestApiKey = async (userId: string): Promise<string> =>
  (await createApiKey(userId)).key;

let callerIp = 0;

/**
 * @function apiCaller
 * @param key {string} token to send
 * @returns {Promise<ApiCaller | null>} who the guard lets the key act as, or null when it answers
 *          401; each call comes from its own IP so failures never reach the auth-fail limit
 */
export const apiCaller = async (key: string): Promise<ApiCaller | null> => {
  callerIp += 1;
  const request = new Request("https://packs.haruhime.moe/api/v1/me", {
    headers: { authorization: `Bearer ${key}`, "x-real-ip": `198.51.100.${callerIp % 250}` },
  });
  const response = await withApiKey(async (_request, caller) => Response.json(caller))(
    request,
    undefined,
  );
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`apiCaller: ${response.status}`);
  return (await response.json()) as ApiCaller;
};

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
