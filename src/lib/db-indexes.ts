/**
 * @file src/lib/db-indexes.ts
 * @desc Every index packs builds on connect (connectDb runs @haruhimemoe/next-kit's
 *       ensureIndexes over this list, one index at a time, never failing the connect): better-auth's
 *       (one user per osu! id, one link per account, sessions by token and user, the session TTL),
 *       the API keys store's (unique userId and hash), the rate_limits TTL, the star-rating
 *       cache's TTL, the pools backfill ledger's TTL, the TTL on better-auth's OAuth state rows
 *       (verification), one hide marker per pool, and pack_revisions' (src/lib/pack-revisions.ts).
 *       Pack indexes come from the mongoose model. Never call apiKeyIndexSpecs' store's own
 *       ensureIndexes() from onConnect: connectedDb waits on this same connect, so it would
 *       deadlock.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import { apiKeyIndexSpecs } from "@haruhimemoe/next-kit/api-keys";
import { AUTH_INDEX_SPECS } from "@haruhimemoe/next-kit/auth";
import { type IndexSpec, ttlIndex } from "@haruhimemoe/next-kit/mongo";
import { counterTtlIndex } from "@haruhimemoe/next-kit/server";
import { revisionIndexSpecs } from "@haruhimemoe/next-kit/vcs";
import { PACK_REVISIONS_COLLECTION } from "@/constants/pack";
import { HIDDEN_ORIGINS_COLLECTION, POOLS_BACKFILL_COLLECTION } from "@/constants/pools";
import {
  STAR_RATINGS_COLLECTION,
  STAR_RATINGS_TTL_INDEX,
  STAR_RATINGS_TTL_SECONDS,
} from "@/constants/star-ratings";

/** The indexes connectDb builds, in no particular order (each is built on its own). */
export const PACKS_INDEX_SPECS: readonly IndexSpec[] = Object.freeze([
  ...AUTH_INDEX_SPECS,
  ...apiKeyIndexSpecs(),
  // Spent rate-limit and osu! budget counters (src/lib/rate-limit.ts, src/lib/osu/budget.ts).
  counterTtlIndex(),
  ttlIndex(STAR_RATINGS_COLLECTION, "fetchedAt", STAR_RATINGS_TTL_SECONDS, STAR_RATINGS_TTL_INDEX),
  // The pools stats backfill's record of tried pairs (src/services/pools-stats-backfill.ts).
  ttlIndex(POOLS_BACKFILL_COLLECTION, "expiresAt"),
  // OAuth state rows: an abandoned sign-in leaves one behind until it expires.
  ttlIndex("verification", "expiresAt"),
  // Hide markers for pools packs (src/services/pools-sync.ts): one per pool.
  { collection: HIDDEN_ORIGINS_COLLECTION, key: { originId: 1 }, unique: true },
  ...revisionIndexSpecs(PACK_REVISIONS_COLLECTION),
]);
