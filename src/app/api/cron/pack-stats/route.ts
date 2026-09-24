/**
 * @file src/app/api/cron/pack-stats/route.ts
 * @desc GET: the daily Vercel cron (vercel.json). Repairs missing or incomplete pack stats, one
 *       capped batch a run (runPackStatsJob), and answers { updated, remaining, waiting }. Vercel
 *       sends `Authorization: Bearer <CRON_SECRET>`. Fails closed: 503 while CRON_SECRET isn't
 *       set or is too short, 401 for a missing or wrong secret, and neither does any work. Never
 *       cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { EnvError, getCronSecret } from "@/env";
import { jsonError } from "@/lib/api";
import { runPackStatsJob } from "@/services/pack-stats";

/** Hobby's limit without fluid compute; one batch takes a few seconds. */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
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

export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    return jsonError(503, "The stats job isn't set up on this server.", "not_configured");
  }
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith(BEARER) || !isSecret(header.slice(BEARER.length), secret)) {
    return jsonError(401, "Not authorized.");
  }
  return Response.json(await runPackStatsJob(), { headers: NO_STORE });
}
