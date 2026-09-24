/**
 * @file tests/integration/lib/rate-limit.test.ts
 * @desc Fixed-window counters in rate_limits: counting, per-subject and per-window isolation,
 *       the TTL index (created by connectDb, shared with the global osu! budget), and per-user
 *       cleanup that leaves the osu! budget counter alone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { deleteRateLimitsFor, hitRateLimit, rateLimitId } from "@/lib/rate-limit";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const NOW = new Date("2026-09-22T12:00:10.000Z");
const counters = () =>
  getDb().collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION);
const USER = "66f0a1b2c3d4e5f6a7b8c9d0";

describe("hitRateLimit", () => {
  it("counts down to zero, then refuses", async () => {
    const rule = { scope: "test", limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit(rule, "s", NOW));
    expect(results.map((r) => [r.allowed, r.remaining])).toEqual([
      [true, 2],
      [true, 1],
      [true, 0],
      [false, 0],
    ]);
    expect(results.every((r) => r.limit === 3 && r.resetSeconds === 50)).toBe(true);
  });

  it("keeps subjects apart", async () => {
    await hitRateLimit(RATE_LIMITS.api, "a", NOW);
    expect((await hitRateLimit(RATE_LIMITS.api, "b", NOW)).remaining).toBe(59);
  });

  it("starts over in the next window", async () => {
    await hitRateLimit(RATE_LIMITS.api, "a", NOW);
    const next = await hitRateLimit(RATE_LIMITS.api, "a", new Date("2026-09-22T12:01:00.000Z"));
    expect(next.remaining).toBe(59);
  });

  it("stores one document per window with its expiry", async () => {
    await hitRateLimit(RATE_LIMITS.api, "a", NOW);
    await hitRateLimit(RATE_LIMITS.api, "a", NOW);
    const doc = await counters().findOne({ _id: rateLimitId(RATE_LIMITS.api, "a", NOW.getTime()) });
    expect(doc).toEqual({
      _id: rateLimitId(RATE_LIMITS.api, "a", NOW.getTime()),
      count: 2,
      expiresAt: new Date("2026-09-22T12:02:00.000Z"),
    });
  });

  it("has the TTL index on expiresAt that connectDb creates", async () => {
    await hitRateLimit(RATE_LIMITS.api, "a", NOW);
    expect(await counters().indexes()).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });

  it("counts concurrent hits exactly", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => hitRateLimit(RATE_LIMITS.apiWrite, "c", NOW)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(
      (await counters().findOne({ _id: rateLimitId(RATE_LIMITS.apiWrite, "c", NOW.getTime()) }))
        ?.count,
    ).toBe(12);
  });
});

describe("deleteRateLimitsFor", () => {
  it.each([".*", "", `${USER}|auth-fail`, USER.toUpperCase()])(
    "refuses %j as a user id and deletes nothing",
    async (userId) => {
      await hitRateLimit(RATE_LIMITS.api, USER, NOW);
      await expect(deleteRateLimitsFor(userId)).rejects.toThrow("not a user id");
      expect(await counters().countDocuments()).toBe(1);
    },
  );

  it("removes that user's counters and nothing else, the osu! budget included", async () => {
    const other = "66f0a1b2c3d4e5f6a7b8c9d1";
    await hitRateLimit(RATE_LIMITS.api, USER, NOW);
    await hitRateLimit(RATE_LIMITS.apiWrite, USER, NOW);
    await hitRateLimit(RATE_LIMITS.keyCreate, USER, NOW);
    await hitRateLimit(RATE_LIMITS.api, other, NOW);
    await hitRateLimit(RATE_LIMITS.authFail, "203.0.113.9", NOW);
    // The global osu! budget counter lives in the same collection.
    await counters().insertOne({
      _id: `osu-api:global:${Date.parse("2026-09-22T12:00:00.000Z") / 1000}`,
      count: 3,
      expiresAt: new Date("2026-09-22T12:02:00.000Z"),
    });
    await deleteRateLimitsFor(USER);
    const left = (await counters().find().toArray()).map((doc) => doc._id.split(":")[1]).sort();
    expect(left).toEqual(["203.0.113.9", "global", other].sort());
  });
});
