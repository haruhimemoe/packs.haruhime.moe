/**
 * @file tests/helpers/db.ts
 * @desc setupTestDb: @haruhimemoe/next-kit's, over packs' database and every collection packs
 *       writes (better-auth's included), emptied before each test and closed after the file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  BETTER_AUTH_COLLECTIONS,
  setupTestDb as setupKitTestDb,
} from "@haruhimemoe/next-kit/testing";
import { closeDb, connectDb, getDb } from "@/lib/db";

/** Our collections; better-auth's come from BETTER_AUTH_COLLECTIONS. */
const COLLECTIONS = [
  "packs",
  "star_ratings",
  "rate_limits",
  "api_keys",
  "deleted_origins",
  "hidden_origins",
  "pools_backfill",
];

/**
 * @function setupTestDb
 * @returns {void} registers beforeEach (connect and clear) and afterAll (close) hooks
 */
export const setupTestDb = (): void =>
  setupKitTestDb({
    connect: connectDb,
    db: getDb,
    close: closeDb,
    collections: [...COLLECTIONS, ...BETTER_AUTH_COLLECTIONS],
  });
