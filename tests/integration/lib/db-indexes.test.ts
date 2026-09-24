/**
 * @file tests/integration/lib/db-indexes.test.ts
 * @desc Indexes we add to collections we don't own through Mongoose: the TTL index that deletes
 *       expired better-auth sessions, and proof that better-auth stores expiresAt as a Date
 *       (a TTL index silently ignores any other type), plus the TTL indexes on cached star ratings
 *       and rate-limit counters, and on the pools backfill's record of tried pairs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { POOLS_BACKFILL_COLLECTION } from "@/constants/pools";
import {
  RATE_LIMITS_COLLECTION,
  STAR_RATINGS_COLLECTION,
  STAR_RATINGS_TTL_INDEX,
  STAR_RATINGS_TTL_SECONDS,
} from "@/constants/star-ratings";
import { connectDb, getDb } from "@/lib/db";
import { ensureIndexes, SESSION_TTL_INDEX } from "@/lib/db-indexes";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("ensureIndexes", () => {
  it("connectDb leaves a TTL index on session.expiresAt that expires rows at expiresAt", async () => {
    await connectDb();
    const indexes = await getDb().collection("session").indexes();
    const ttl = indexes.find((index) => index.name === SESSION_TTL_INDEX);
    expect(ttl?.key).toEqual({ expiresAt: 1 });
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it("is safe to run again", async () => {
    await ensureIndexes(getDb());
    await ensureIndexes(getDb());
    const names = (await getDb().collection("session").indexes()).map((index) => index.name);
    expect(names.filter((name) => name === SESSION_TTL_INDEX)).toHaveLength(1);
  });

  it("better-auth stores session.expiresAt as a Date, so the TTL index applies", async () => {
    await createTestUser();
    const row = await getDb().collection("session").findOne({});
    expect(row?.expiresAt).toBeInstanceOf(Date);
  });

  it("logs and carries on when the index can't be created", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      collection: () => ({
        createIndex: () => Promise.reject(new Error("not authorized")),
      }),
    } as unknown as Parameters<typeof ensureIndexes>[0];
    await expect(ensureIndexes(db)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("db: couldn't create indexes", expect.any(Error));
    error.mockRestore();
  });

  it("expires cached star ratings 30 days after they were fetched", async () => {
    await connectDb();
    const ttl = (await getDb().collection(STAR_RATINGS_COLLECTION).indexes()).find(
      (index) => index.name === STAR_RATINGS_TTL_INDEX,
    );
    expect(ttl?.key).toEqual({ fetchedAt: 1 });
    expect(ttl?.expireAfterSeconds).toBe(STAR_RATINGS_TTL_SECONDS);
  });

  it("expires rate-limit counters at expiresAt", async () => {
    await connectDb();
    expect(await getDb().collection(RATE_LIMITS_COLLECTION).indexes()).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });

  it("expires the pools backfill's record of tried pairs at expiresAt", async () => {
    await connectDb();
    expect(await getDb().collection(POOLS_BACKFILL_COLLECTION).indexes()).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });
});
