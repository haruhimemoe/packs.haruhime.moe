/**
 * @file src/constants/star-ratings.ts
 * @desc Star ratings with mods: the Mongo cache, the global osu! API budget (the same document
 *       shape as the rate limits in src/lib/rate-limit.ts) and each IP's share of it, per-request
 *       limits, and the browser's timing. Shared by the server and the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import type { ModAcronym } from "@haruhimemoe/pool";

export const STAR_RATINGS_COLLECTION = "star_ratings";
/** A cached rating lives 30 days, so a difficulty update on osu! shows within a month. */
export const STAR_RATINGS_TTL_SECONDS = 2_592_000;
export const STAR_RATINGS_TTL_INDEX = "star_ratings_fetchedAt_ttl";

export const RATE_LIMITS_COLLECTION = "rate_limits";
/** Our calls to osu!, across every function instance. osu! asks for about 60 a minute. */
export const OSU_API_BUDGET = {
  scope: "osu-api",
  subject: "global",
  limit: 50,
  windowSeconds: 60,
} as const;

/**
 * Each IP's share of those calls (IPv6 by its /64), across star ratings and fallback lookups.
 * Equal to MAX_OSU_FETCHES_PER_REQUEST, so a new visitor's first request is always served, and
 * one caller takes at most 40% of OSU_API_BUDGET.
 */
export const OSU_API_BUDGET_PER_IP = {
  scope: "osu-api-ip",
  limit: 20,
  windowSeconds: 60,
} as const;

export const MAX_OSU_FETCHES_PER_REQUEST = 20;
export const OSU_FETCH_CONCURRENCY = 4;
/** 64 slots, each a freemod slot with 4 sets, is 256; room to spare, never unbounded. */
export const MAX_STAR_PAIRS = 320;
/** The longest pair ("2147483647:HDHRDT,") is 18 characters; q past this is refused unread. */
export const MAX_STAR_QUERY_LENGTH = MAX_STAR_PAIRS * 24;

/** Browser: ask again this long after an answer with pending pairs, at most this many times. */
export const STAR_RETRY_MS = 5000;
export const STAR_MAX_RETRIES = 12;
/** Browser: in the editor, wait this long after the last change before asking. */
export const EDITOR_STAR_DELAY_MS = 1500;

/** One (beatmap, mod set) rating: key is "129891:HDHR". */
export type StarPair = { key: string; beatmapId: number; set: ModAcronym[] };
