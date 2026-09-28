/**
 * @file src/constants/pack-stats.ts
 * @desc Pack stats: the mod codes a pack's stats can hold, how much osu! and mirror work one
 *       stats run may do, and how long incomplete stats wait between retries. Shared by the server
 *       (which computes stats) and the browser (which filters on them). Which mods change a star
 *       rating or the speed comes from @haruhimemoe/pool (changesStarRating, speedRate).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

/**
 * Every mod code a pack's `stats.mods` can hold, in filter-chip order: the six built-in buckets,
 * then the mods only a custom slot can force. Stats list their codes in this order.
 */
export const STAT_MOD_CODES = ["NM", "HD", "HR", "DT", "FM", "TB", "EZ", "HT", "FL"] as const;

export type StatModCode = (typeof STAT_MOD_CODES)[number];

/**
 * Packs one run of the stats job takes (the daily cron and the admin button). 25 packs of 64
 * maps is 16 mirror calls, and the job's osu! calls stay under MAX_OSU_FETCHES_PER_REQUEST (20
 * mod ratings) plus MAX_OSU_METADATA_CALLS, about half of one minute's global osu! budget.
 */
export const PACK_STATS_JOB_LIMIT = 25;

/**
 * Longest wait, in days, before the stats job retries a pack whose stats keep coming out
 * incomplete. The wait doubles from about a day after each incomplete result (statsRetryAt).
 */
export const PACK_STATS_RETRY_MAX_DAYS = 30;

/** osu! calls one metadata lookup may spend on ids the mirror doesn't know (50 ids a call). */
export const MAX_OSU_METADATA_CALLS = 4;

/** Mirror metadata calls (100 ids each) in flight at once. */
export const MIRROR_LOOKUP_CONCURRENCY = 4;
