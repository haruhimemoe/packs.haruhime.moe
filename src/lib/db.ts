/**
 * @file src/lib/db.ts
 * @desc The one MongoClient per process, from @haruhimemoe/next-kit's createMongo on the `packs`
 *       database: mongoose models register on getModelConnection(), and services call
 *       connectDb() (or connectedDb()) first. The haruhime.moe hub's `identity` database (users
 *       and sessions) sits on the same client, read-only for packs' Atlas user, so packs never
 *       writes or builds an index there. The first connect builds PACKS_INDEX_SPECS on packs
 *       only; a failed connect is retried on the next call. Nothing connects at import time.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { createMongo, ensureIndexes } from "@haruhimemoe/next-kit/mongo";
import { getDatabaseUri } from "@/env";
import { PACKS_INDEX_SPECS } from "@/lib/db-indexes";

export const DB_NAME = "packs";

/** The hub's identity database: packs reads users and sessions there, never writes. */
export const IDENTITY_DB_NAME = "identity";

export const {
  getMongoClient,
  getDb,
  getIdentityDb,
  getModelConnection,
  connectDb,
  connectedDb,
  closeDb,
} = createMongo({
  dbName: DB_NAME,
  identityDbName: IDENTITY_DB_NAME,
  globalKey: "__packsMongo",
  uri: getDatabaseUri,
  // packs' own indexes only: packs' Atlas user can't write identity, the hub owns its indexes.
  onConnect: async ({ db }) => {
    await ensureIndexes(db, PACKS_INDEX_SPECS);
  },
});
