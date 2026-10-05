/**
 * @file src/lib/pack-revisions.ts
 * @desc Saved packs' history: next-kit's revision store over pack_revisions, one line of
 *       snapshots per pack (src/utils/pack-snapshot.ts), keyed by the pack's slug (its doc id
 *       never changes; deleting a pack deletes its history, so a reissued slug starts clean).
 *       Nothing connects at import.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import { createRevisionStore } from "@haruhimemoe/next-kit/vcs";
import { PACK_REVISIONS_COLLECTION } from "@/constants/pack";
import { connectedDb } from "@/lib/db";
import { PACK_CODEC, type PackSnapshot } from "@/utils/pack-snapshot";

/** Every saved pack's revisions. */
export const packRevisions = createRevisionStore<PackSnapshot>({
  db: connectedDb,
  collection: PACK_REVISIONS_COLLECTION,
  codec: PACK_CODEC,
});
