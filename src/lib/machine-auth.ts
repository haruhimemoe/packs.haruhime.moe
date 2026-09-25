/**
 * @file src/lib/machine-auth.ts
 * @desc Bearer secrets for machine-only routes, which read no session or cookies: CRON_SECRET for
 *       the daily stats job (Vercel Cron), and POOLS_SERVICE_TOKEN for the routes pools.haruhime.moe
 *       calls (/api/service/pools/*). Both fail closed: 503 not_configured while the secret isn't
 *       set or is too short (logged by name, never by value), 401 for a missing or wrong one. The
 *       comparison hashes both sides with SHA-256 and compares the digests with timingSafeEqual,
 *       so the time taken says nothing about the secret's length or content. A missing or wrong
 *       pools token also counts against the caller's IP (RATE_LIMITS.serviceAuthFail): past the
 *       limit the answer is 429 instead of 401. The token is compared before anything is counted,
 *       so the right one always gets through, even from an IP past the limit (pools shares its
 *       outbound IPs with other Vercel projects). The counter tells a failing caller to back off;
 *       it isn't guessing protection. The token's randomness is (.env.example: openssl rand).
 *       Every pools refusal is no-store.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { RATE_LIMITS } from "@/constants/api";
import { EnvError, getCronSecret, getPoolsServiceToken } from "@/env";
import { jsonError } from "@/lib/api";
import { hitRateLimit, tooManyRequests, withHeaders } from "@/lib/rate-limit";
import { clientIp, rateLimitSubject } from "@/utils/client-ip";

const BEARER = "Bearer ";
const NO_STORE = { "Cache-Control": "no-store" };
const POOLS_NOT_CONFIGURED = "The pools service isn't set up on this server.";

const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

/**
 * @function sameSecret
 * @param given {string} what the request sent
 * @param secret {string} the configured secret
 * @returns {boolean} whether they're equal, compared as SHA-256 digests with timingSafeEqual
 */
export const sameSecret = (given: string, secret: string): boolean =>
  timingSafeEqual(digest(given), digest(secret));

/** The secret, or undefined when it's unset or too short (logged by name, never by value). */
const configured = (read: () => string | undefined, label: string): string | undefined => {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    console.error(`[${label}] ${error.message}`);
    return undefined;
  }
};

/** Whether the request carries `Authorization: Bearer <secret>`. */
const carries = (request: Request, secret: string): boolean => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith(BEARER) && sameSecret(header.slice(BEARER.length), secret);
};

/**
 * @function refuseWithoutCronSecret
 * @param request {Request} the incoming request
 * @param notConfigured {string} the 503 message while CRON_SECRET isn't set up
 * @returns {Response | null} a 503 or 401 to send back, or null when the request carries the
 *          secret
 */
export const refuseWithoutCronSecret = (
  request: Request,
  notConfigured: string,
): Response | null => {
  const secret = configured(getCronSecret, "cron");
  if (!secret) return jsonError(503, notConfigured, "not_configured");
  return carries(request, secret) ? null : jsonError(401, "Not authorized.");
};

/**
 * @function refuseWithoutPoolsToken
 * @param request {Request} a request to /api/service/pools/*
 * @returns {Promise<Response | null>} null when it carries POOLS_SERVICE_TOKEN, however often its
 *          IP failed; otherwise a no-store 503 (not set up), 401 (missing or wrong, counted
 *          against its IP) or 429 (that IP failed too often this minute)
 */
export const refuseWithoutPoolsToken = async (request: Request): Promise<Response | null> => {
  const token = configured(getPoolsServiceToken, "pools");
  if (!token) return withHeaders(jsonError(503, POOLS_NOT_CONFIGURED, "not_configured"), NO_STORE);
  if (carries(request, token)) return null;
  const failures = await hitRateLimit(
    RATE_LIMITS.serviceAuthFail,
    rateLimitSubject(clientIp(request.headers)),
  );
  if (!failures.allowed) return withHeaders(tooManyRequests(failures), NO_STORE);
  return withHeaders(jsonError(401, "Not authorized."), NO_STORE);
};
