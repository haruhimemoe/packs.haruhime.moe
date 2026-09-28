/**
 * @file src/lib/machine-auth.ts
 * @desc Machine auth for the routes that take a Bearer secret instead of a session: the daily
 *       stats cron (CRON_SECRET) and the pools service routes (POOLS_SERVICE_TOKEN), through
 *       @haruhimemoe/next-kit's refuseWithoutBearer. The secret is compared before anything is
 *       counted, so the right one always gets through; a pools caller that keeps failing is told
 *       to back off (RATE_LIMITS.serviceAuthFail per IP a minute).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { refuseWithoutBearer } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { getCronSecret, getPoolsServiceToken } from "@/env";
import { limiter } from "@/lib/rate-limit";

/**
 * @function refuseWithoutCronSecret
 * @param request {Request} the incoming request
 * @param notConfigured {string} the 503 message while CRON_SECRET isn't set up
 * @returns {Promise<Response | null>} null when the request carries the secret, else a 503
 *          (not set up) or 401
 */
export const refuseWithoutCronSecret = (
  request: Request,
  notConfigured: string,
): Promise<Response | null> =>
  refuseWithoutBearer(request, { secret: getCronSecret, label: "cron", notConfigured });

/**
 * @function refuseWithoutPoolsToken
 * @param request {Request} a request to /api/service/pools/*
 * @returns {Promise<Response | null>} null when it carries POOLS_SERVICE_TOKEN, however often its
 *          IP failed; otherwise a no-store 503 (not set up), 401 (missing or wrong, counted
 *          against its IP) or 429 (that IP failed too often this minute)
 */
export const refuseWithoutPoolsToken = (request: Request): Promise<Response | null> =>
  refuseWithoutBearer(request, {
    secret: getPoolsServiceToken,
    label: "pools",
    notConfigured: "The pools service isn't set up on this server.",
    failures: { limiter, rule: RATE_LIMITS.serviceAuthFail },
    noStore: true,
  });
