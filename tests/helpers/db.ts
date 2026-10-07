/**
 * @file tests/helpers/db.ts
 * @desc setupTestDb: @haruhimemoe/next-kit's, over packs' database and every collection packs
 *       writes, emptied before each test and closed after the file. The hub's identity users and
 *       sessions (which tests/helpers/auth.ts writes, standing in for the hub) are emptied too.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { setupTestDb as setupKitTestDb } from "@haruhimemoe/next-kit/testing";
import { beforeEach } from "vitest";
import { closeDb, connectDb, getDb, getIdentityDb } from "@/lib/db";

/** Every collection packs writes. */
const COLLECTIONS = [
  "packs",
  "star_ratings",
  "rate_limits",
  "api_keys",
  "deleted_origins",
  "hidden_origins",
  "pools_backfill",
  "pack_revisions",
];

/** The identity collections the session reader reads. */
const IDENTITY_COLLECTIONS = ["user", "session"];

/**
 * @function setupTestDb
 * @returns {void} registers beforeEach (connect and clear) and afterAll (close) hooks
 */
export const setupTestDb = (): void => {
  setupKitTestDb({ connect: connectDb, db: getDb, close: closeDb, collections: COLLECTIONS });
  beforeEach(async () => {
    const identity = getIdentityDb();
    await Promise.all(IDENTITY_COLLECTIONS.map((name) => identity.collection(name).deleteMany({})));
  });
};
