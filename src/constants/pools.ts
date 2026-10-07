/**
 * @file src/constants/pools.ts
 * @desc pools.haruhime.moe publishes tournament pools as packs: the haruhime pools account
 *       that owns them. A system account (SYSTEM_USER_IDS in src/constants/db.ts): no user row in
 *       packs or in the hub's identity database, just a fixed id its packs carry as ownerId, and
 *       the name and avatar below that lists show. Nobody can sign in or use an API key as it
 *       (src/lib/auth.ts, src/services/api-keys.ts refuse it). Also a
 *       pools pool id's shape, the origin kind, where tombstones and hide markers live, the
 *       rate-limit subject pools' saves and the stats backfill spend osu! calls under, and where
 *       that backfill writes down the rating pairs it tried.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import { SITE } from "@/constants/site";

/**
 * The account. The id spells "haruhimepool" in ASCII hex. Its email can't be an osu! sign-in's
 * (those are `<osu id>@osu.local`), and `.invalid` never resolves.
 */
export const POOLS_ACCOUNT = Object.freeze({
  id: "6861727568696d65706f6f6c",
  name: "haruhime pools",
  email: "pools@packs.invalid",
  avatarUrl: `${SITE.url}/brand/packs-icon.svg`,
});

/** `origin.kind` on a pack pools publishes. */
export const POOLS_ORIGIN_KIND = "pools";

/** Tombstones: the pools ids of packs a moderator deleted (the id is the document's _id). */
export const DELETED_ORIGINS_COLLECTION = "deleted_origins";

/**
 * Hide markers: `{ originId, hiddenAt }` for a pools pack a moderator hid that pools then deleted,
 * so the pack pools creates next for that pool comes back hidden. One per pool (a unique index on
 * originId, src/lib/db-indexes.ts); an unhide on packs drops it.
 */
export const HIDDEN_ORIGINS_COLLECTION = "hidden_origins";

/**
 * The rate-limit subject pools' saves and the stats backfill spend osu! calls under: a share of the
 * global budget of its own (OSU_API_BUDGET_PER_IP, 20 a minute), never a visitor's.
 */
export const POOLS_SYNC_SUBJECT = "pools-sync";

/** The pools stats backfill's record of rating pairs it asked osu! about that didn't come back rated. */
export const POOLS_BACKFILL_COLLECTION = "pools_backfill";

/**
 * How long a backfill remembers those pairs, and a pack it ran out of pairs for: within a day it
 * never asks twice, and a rerun the next day tries the failures again.
 */
export const POOLS_BACKFILL_WINDOW_MS = 24 * 60 * 60 * 1000;
