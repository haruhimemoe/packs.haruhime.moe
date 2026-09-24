/**
 * @file tests/helpers/db.ts
 * @desc setupTestDb(): empty every collection before each test, close the client after the file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterAll, beforeEach } from "vitest";
import { closeDb, connectDb, getDb } from "@/lib/db";

/** Our collections plus better-auth's (mongodb adapter defaults). */
const COLLECTIONS = [
  "packs",
  "user",
  "session",
  "account",
  "verification",
  "star_ratings",
  "rate_limits",
  "api_keys",
];

/**
 * @function setupTestDb
 * @returns {void} registers beforeEach (clear) and afterAll (close) hooks
 */
export const setupTestDb = (): void => {
  beforeEach(async () => {
    await connectDb();
    await Promise.all(COLLECTIONS.map((name) => getDb().collection(name).deleteMany({})));
  });
  afterAll(closeDb);
};
