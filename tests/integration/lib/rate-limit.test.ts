/**
 * @file tests/integration/lib/rate-limit.test.ts
 * @desc packs' wiring of @haruhimemoe/next-kit's limiter (counting and windows are the package's
 *       own tests): counters land in rate_limits with the TTL index connectDb creates, and
 *       deleteRateLimitsFor removes one user's counters, escaping the id, and nothing else.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { deleteRateLimitsFor, limiter } from "@/lib/rate-limit";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const counters = () =>
  getDb().collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION);
const USER = "66f0a1b2c3d4e5f6a7b8c9d0";

describe("limiter", () => {
  it("counts in rate_limits, which has the TTL index on expiresAt that connectDb creates", async () => {
    expect((await limiter.hit(RATE_LIMITS.api, "a")).remaining).toBe(RATE_LIMITS.api.limit - 1);
    expect(await counters().countDocuments()).toBe(1);
    expect(await counters().indexes()).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });
});

describe("deleteRateLimitsFor", () => {
  it.each([".*", `${USER}|auth-fail`])("deletes nothing for %j", async (userId) => {
    await limiter.hit(RATE_LIMITS.api, USER);
    expect(await deleteRateLimitsFor(userId)).toBe(0);
    expect(await counters().countDocuments()).toBe(1);
  });

  it("removes that user's counters and nothing else, the osu! budget included", async () => {
    const other = "66f0a1b2c3d4e5f6a7b8c9d1";
    await limiter.hit(RATE_LIMITS.api, USER);
    await limiter.hit(RATE_LIMITS.apiWrite, USER);
    await limiter.hit(RATE_LIMITS.keyCreate, USER);
    await limiter.hit(RATE_LIMITS.api, other);
    await limiter.hit(RATE_LIMITS.authFail, "203.0.113.9");
    // The global osu! budget counter lives in the same collection.
    await counters().insertOne({
      _id: `osu-api:global:${Math.floor(Date.now() / 60_000) * 60}`,
      count: 3,
      expiresAt: new Date(Date.now() + 120_000),
    });
    expect(await deleteRateLimitsFor(USER)).toBe(3);
    const left = (await counters().find().toArray()).map((doc) => doc._id.split(":")[1]).sort();
    expect(left).toEqual(["203.0.113.9", "global", other].sort());
  });
});
