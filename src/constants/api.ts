/**
 * @file src/constants/api.ts
 * @desc Public API (/api/v1) settings: key format, page size, rate limits (the API's, and the
 *       per-IP and per-user limits on the app's own routes), and where the docs live.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

/** Can't be mistaken for a pack key (pk1.). */
export const API_KEY_PREFIX = "hpk_";
/** Random bytes in a key: 43 base64url characters. */
export const API_KEY_BYTES = 32;
/** Characters of a key shown on /me and in data exports ("hpk_" + 8). */
export const API_KEY_DISPLAY_LENGTH = 12;

/** ownerName when the owner's record has no osu! username (or is gone). */
export const UNKNOWN_OWNER_NAME = "Unknown player";

/** GET /api/v1/packs page size. */
export const API_PAGE_SIZE = 50;
/** lastUsedAt is written at most this often, to save writes. */
export const LAST_USED_INTERVAL_MS = 60 * 60 * 1000;

export const API_DOCS_PATH = "/docs/api";
export const OPENAPI_PATH = "/api/v1/openapi.json";

export type RateLimitRule = { scope: string; limit: number; windowSeconds: number };

/** Fixed windows; counters live in the rate_limits collection (src/lib/rate-limit.ts). */
export const RATE_LIMITS = {
  /** Every /api/v1 request, per user. */
  api: { scope: "api", limit: 60, windowSeconds: 60 },
  /**
   * POST/PUT/PATCH/DELETE on /api/v1, per user (also counted by `api`). The session pack routes
   * (/api/packs, /api/packs/{slug}, /api/packs/{slug}/exports) count against the same counter,
   * so the web and the API share one allowance.
   */
  apiWrite: { scope: "api-write", limit: 10, windowSeconds: 60 },
  /** Missing, bad, or revoked keys, per IP. */
  authFail: { scope: "auth-fail", limit: 20, windowSeconds: 60 },
  /** Create or regenerate on /me, per user. */
  keyCreate: { scope: "key-create", limit: 10, windowSeconds: 3600 },
  /**
   * GET /api/osu/star-ratings, per IP. A pool view asks once, then every 5 s at most 12 times
   * (13 a minute); the editor asks 1.5 s after the last change. 120 leaves room for several tabs
   * and a busy editing session and still stops a flood.
   */
  osuStarRatings: { scope: "osu-stars", limit: 120, windowSeconds: 60 },
  /**
   * GET /api/osu/beatmaps, per IP. The browser asks only for ids the mirror doesn't know, once
   * per lookup (retries are a button), so a real session makes a handful a minute.
   */
  osuBeatmaps: { scope: "osu-beatmaps", limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;
