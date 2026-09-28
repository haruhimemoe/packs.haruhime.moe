/**
 * @file src/lib/db.ts
 * @desc The one MongoClient per process, from @haruhimemoe/next-kit's createMongo on the `packs`
 *       database: better-auth uses getDb(), mongoose models register on getModelConnection(),
 *       and services call connectDb() (or connectedDb()) first. The first connect builds
 *       PACKS_INDEX_SPECS; a failed connect is retried on the next call. Nothing connects at
 *       import time.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { createMongo, ensureIndexes } from "@haruhimemoe/next-kit/mongo";
import { getDatabaseUri } from "@/env";
import { PACKS_INDEX_SPECS } from "@/lib/db-indexes";

export const DB_NAME = "packs";

export const { getMongoClient, getDb, getModelConnection, connectDb, connectedDb, closeDb } =
  createMongo({
    dbName: DB_NAME,
    globalKey: "__packsMongo",
    uri: getDatabaseUri,
    onConnect: async (db) => {
      await ensureIndexes(db, PACKS_INDEX_SPECS);
    },
  });
