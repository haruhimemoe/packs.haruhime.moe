/**
 * @file src/constants/db.ts
 * @desc Collection names that hold a user, the system accounts packs runs itself, and every field
 *       holding an identity user id (for the hub's identity migration).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { PACK_REVISIONS_COLLECTION } from "@/constants/pack";
import { POOLS_ACCOUNT } from "@/constants/pools";

/** Saved packs (the Pack model's collection). */
export const PACKS_COLLECTION = "packs";

/** API keys (next-kit's api-keys store), one per user, keyed by the user id. */
export const API_KEYS_COLLECTION = "api_keys";

/**
 * System accounts: packs-side owners that are never a person, so never a haruhime.moe user. Only
 * the haruhime pools account. Their name and avatar come from here, not from identity, and a
 * session or API key acting as one is refused (src/lib/auth.ts, src/services/api-keys.ts).
 */
export const SYSTEM_USER_IDS: ReadonlySet<string> = new Set([POOLS_ACCOUNT.id]);

/**
 * Every packs field holding an identity user id, as next-kit's migrateIdentity takes them (it
 * rewrites hex strings and ObjectIds alike, each keeping its type). packs.ownerId, packs.hiddenBy
 * and api_keys.userId are ObjectIds; pack_revisions.authorId is a hex string. rate_limits' api,
 * api-write and key-create counters embed the user id in their _id; they expire within the hour,
 * so they aren't listed. The pools account (SYSTEM_USER_IDS) owns packs too, under its fixed id:
 * its old `user` row must be gone from packs before a rerun, or it would be rewritten as well.
 */
export const USER_ID_REFERENCES: readonly { collection: string; field: string }[] = [
  { collection: PACKS_COLLECTION, field: "ownerId" },
  { collection: PACKS_COLLECTION, field: "hiddenBy" },
  { collection: API_KEYS_COLLECTION, field: "userId" },
  { collection: PACK_REVISIONS_COLLECTION, field: "authorId" },
];
