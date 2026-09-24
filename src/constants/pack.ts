/**
 * @file src/constants/pack.ts
 * @desc Pack limits and defaults shared by schemas and the builder UI. The pool limits (slots,
 *       name length, slot number) come from @haruhimemoe/pool and are re-exported here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

export { MAX_NAME_LENGTH, MAX_SLOT_INDEX, MAX_SLOTS } from "@haruhimemoe/pool";

export const DEFAULT_PACK_NAME = "Untitled pack";
/** Per-account cap on saved packs; keeps worst-case storage far below Atlas M0's 512 MB. */
export const MAX_SAVED_PACKS = 200;
/** Packs per page on /me, GET /api/packs, and GET /api/v1/me/packs. */
export const OWN_PAGE_SIZE = 50;
/** nanoid length for /p/{slug}. */
export const SLUG_LENGTH = 10;

/** Saved pack description limit (UTF-16 units, like the name). */
export const MAX_DESCRIPTION_LENGTH = 500;
/** Description excerpt on public cards and in the search index (characters). */
export const DESCRIPTION_EXCERPT_LENGTH = 140;

/** Magnet links a saved pack can list. */
export const MAX_PACK_EXPORTS = 10;

/** Ours are about 600 characters with seven trackers. */
export const MAX_MAGNET_LENGTH = 2048;
