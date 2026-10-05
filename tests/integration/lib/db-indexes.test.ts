/**
 * @file tests/integration/lib/db-indexes.test.ts
 * @desc Indexes connectDb builds (PACKS_INDEX_SPECS, through next-kit's ensureIndexes): every
 *       one exists, the session TTL (and proof that better-auth stores expiresAt as a Date, which
 *       a TTL index needs), the TTLs on cached star ratings, rate-limit counters, the pools
 *       backfill's record of tried pairs and sign-in state rows, and one hide marker per pool.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { AUTH_INDEXES } from "@haruhimemoe/next-kit/auth";
import { indexName } from "@haruhimemoe/next-kit/mongo";
import { describe, expect, it } from "vitest";
import { PACK_REVISIONS_COLLECTION } from "@/constants/pack";
import { HIDDEN_ORIGINS_COLLECTION, POOLS_BACKFILL_COLLECTION } from "@/constants/pools";
import {
  RATE_LIMITS_COLLECTION,
  STAR_RATINGS_COLLECTION,
  STAR_RATINGS_TTL_INDEX,
  STAR_RATINGS_TTL_SECONDS,
} from "@/constants/star-ratings";
import { connectDb, getDb } from "@/lib/db";
import { PACKS_INDEX_SPECS } from "@/lib/db-indexes";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("PACKS_INDEX_SPECS", () => {
  it("connectDb builds every one", async () => {
    await connectDb();
    for (const spec of PACKS_INDEX_SPECS) {
      const names = (await getDb().collection(spec.collection).indexes()).map((i) => i.name);
      expect(names, spec.collection).toContain(indexName(spec));
    }
  });

  it("connectDb leaves a TTL index on session.expiresAt that expires rows at expiresAt", async () => {
    await connectDb();
    const indexes = await getDb().collection("session").indexes();
    const ttl = indexes.find((index) => index.name === AUTH_INDEXES.sessionTtl);
    expect(ttl?.key).toEqual({ expiresAt: 1 });
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it("better-auth stores session.expiresAt as a Date, so the TTL index applies", async () => {
    await createTestUser();
    const row = await getDb().collection("session").findOne({});
    expect(row?.expiresAt).toBeInstanceOf(Date);
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

  it("keeps one hide marker per pools pool", async () => {
    await connectDb();
    const markers = getDb().collection(HIDDEN_ORIGINS_COLLECTION);
    expect(await markers.indexes()).toContainEqual(
      expect.objectContaining({ key: { originId: 1 }, unique: true }),
    );
    await markers.insertOne({ originId: "otdb-58", hiddenAt: new Date() });
    await expect(markers.insertOne({ originId: "otdb-58", hiddenAt: new Date() })).rejects.toThrow(
      /duplicate key/,
    );
  });

  it("keeps one revision per docId/seq in pack history", async () => {
    await connectDb();
    expect(await getDb().collection(PACK_REVISIONS_COLLECTION).indexes()).toContainEqual(
      expect.objectContaining({ key: { docId: 1, seq: -1 }, unique: true }),
    );
  });

  it("expires sign-in state rows (verification) at expiresAt", async () => {
    await connectDb();
    expect(await getDb().collection("verification").indexes()).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });
});
