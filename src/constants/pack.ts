/**
 * @file src/constants/pack.ts
 * @desc Pack limits and defaults shared by schemas and the builder UI. The pool limits (slots,
 *       name length, slot number, description length) come from @haruhimemoe/pool. Also the
 *       revisions collection name (src/lib/pack-revisions.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

export const DEFAULT_PACK_NAME = "Untitled pack";
/** Per-account cap on saved packs; keeps worst-case storage far below Atlas M0's 512 MB. */
export const MAX_SAVED_PACKS = 200;
/** Packs per page on /me, GET /api/packs, and GET /api/v1/me/packs. */
export const OWN_PAGE_SIZE = 50;
/** nanoid length for /p/{slug}. */
export const SLUG_LENGTH = 10;

/** Description excerpt on public cards and in the search index (characters). */
export const DESCRIPTION_EXCERPT_LENGTH = 140;

/** Magnet links a saved pack can list. */
export const MAX_PACK_EXPORTS = 10;

/** Ours are about 600 characters with seven trackers. */
export const MAX_MAGNET_LENGTH = 2048;

/** A pack's revision history (src/lib/pack-revisions.ts), keyed by slug. */
export const PACK_REVISIONS_COLLECTION = "pack_revisions";
