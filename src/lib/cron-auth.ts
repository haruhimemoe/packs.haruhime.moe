/**
 * @file src/lib/cron-auth.ts
 * @desc CRON_SECRET checks for machine-only routes: the daily stats job (Vercel Cron). Callers
 *       send `Authorization: Bearer <CRON_SECRET>`. Fails closed: 503 while CRON_SECRET isn't set
 *       or is too short, 401 for a missing or wrong secret. The comparison takes the same time
 *       whatever was sent.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { EnvError, getCronSecret } from "@/env";
import { jsonError } from "@/lib/api";

const BEARER = "Bearer ";

const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

/** Compares digests, so the time taken says nothing about the secret's length or content. */
const isSecret = (given: string, secret: string): boolean =>
  timingSafeEqual(digest(given), digest(secret));

/** CRON_SECRET, or undefined when it's unset or too short (logged by name, never by value). */
const cronSecret = (): string | undefined => {
  try {
    return getCronSecret();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    console.error(`[cron] ${error.message}`);
    return undefined;
  }
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
  const secret = cronSecret();
  if (!secret) return jsonError(503, notConfigured, "not_configured");
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith(BEARER) || !isSecret(header.slice(BEARER.length), secret)) {
    return jsonError(401, "Not authorized.");
  }
  return null;
};
