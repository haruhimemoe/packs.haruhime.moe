/**
 * @file src/constants/map-usage.ts
 * @desc Map usage (pool archive spec, part 2): which archive packs used a beatmap. The collection
 *       it lives in, the most ids one request takes, how long answers stay in the CDN cache, and
 *       how long the editor waits before asking. Shared by the server and the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/** One document per beatmap id that archive packs use (src/services/map-usage.ts). */
export const MAP_USAGE_COLLECTION = "map_usage";

/** GET /api/v1/beatmaps/usage takes at most this many ids. A whole pack always fits. */
export const MAX_USAGE_IDS = 100;

/**
 * Usage only changes when an archive pack is imported, hidden, unhidden or deleted: an hour in
 * the CDN, and up to a day of a stale answer while it fetches a fresh one.
 */
export const MAP_USAGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

/** The editor asks once the pool has held still this long (milliseconds). */
export const MAP_USAGE_EDITOR_DELAY_MS = 1500;
