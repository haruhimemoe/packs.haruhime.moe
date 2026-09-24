/**
 * @file src/lib/api.ts
 * @desc Shared pieces for our JSON route handlers: { error: { code, message } } responses, body
 *       parsing, the `?ids=` list the osu! routes take (and the map usage routes' messages), and
 *       the same-origin guard for cookie mutations without a body. Bodies must be application/json (a cross-site form can't send
 *       that without a CORS preflight) and small.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import type { z } from "zod";
import { MAX_USAGE_IDS } from "@/constants/map-usage";
import { MAX_SLOTS } from "@/constants/pack";
import { SITE } from "@/constants/site";
import type { ApiErrorBody } from "@/schemas/api";
import { beatmapIdSchema } from "@/schemas/pack";

/** A 64-slot pack is under 3 KB of JSON. */
export const MAX_BODY_BYTES = 16_384;
export const SIGN_IN_REQUIRED = "Sign in with osu! to save packs.";
export const PACK_NOT_FOUND = "Pack not found.";
export const BAD_PAGE = "Use a page number from 1 to 999999.";
export const BAD_BEATMAP_IDS = `Pass 1 to ${MAX_SLOTS} beatmap ids as ?ids=1,2,3.`;
export const BAD_USAGE_ID = "Use a beatmap ID: a whole number from 1 to 2147483647.";
export const BAD_USAGE_IDS = `Pass 1 to ${MAX_USAGE_IDS} beatmap IDs as ?ids=1,2,3.`;

/** The longest valid id (2147483647, 10 digits) plus a comma; a longer ?ids= is refused unread. */
const MAX_IDS_QUERY_LENGTH = MAX_SLOTS * 11;

/** Stable machine codes per status. Messages are for people and may change; codes don't. */
export const ERROR_CODES = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
  500: "internal_error",
  502: "upstream_error",
} as const satisfies Record<number, string>;

/**
 * @function errorCodeFor
 * @param status {number} HTTP status
 * @returns {string} its code from ERROR_CODES; otherwise "internal_error" for 5xx, "bad_request"
 */
export const errorCodeFor = (status: number): string =>
  (ERROR_CODES as Record<number, string>)[status] ??
  (status >= 500 ? "internal_error" : "bad_request");

/**
 * @function jsonError
 * @param status {number} HTTP status
 * @param message {string} shown to the person
 * @param code {string} machine code (default: from the status)
 * @returns {Response} `{ error: { code, message } }` JSON
 */
export const jsonError = (
  status: number,
  message: string,
  code: string = errorCodeFor(status),
): Response => Response.json({ error: { code, message } } satisfies ApiErrorBody, { status });

/**
 * @function parseJsonBody
 * @param request {Request} incoming request
 * @param schema {z.ZodType} what the body must be
 * @param options {{ tooLarge?: string }} the 413 message (default: about a pack)
 * @returns {Promise<{ ok: true; data } | { ok: false; response }>} parsed data or a ready error response
 */
export const parseJsonBody = async <T extends z.ZodType>(
  request: Request,
  schema: T,
  { tooLarge = "That pack is too large." }: { tooLarge?: string } = {},
): Promise<{ ok: true; data: z.output<T> } | { ok: false; response: Response }> => {
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith("application/json")) {
    return { ok: false, response: jsonError(415, "Send the request as JSON.") };
  }
  // Refuse an honest oversized body before reading it; still measure what actually arrived.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError(413, tooLarge) };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError(413, tooLarge) };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, "That request wasn't valid JSON.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(400, parsed.error.issues[0]?.message ?? "That pack isn't valid."),
    };
  }
  return { ok: true, data: parsed.data };
};

/**
 * @function parseBeatmapIds
 * @param raw {string | null} the `ids` query value, comma-separated
 * @returns {number[] | null} the ids as sent (1 to MAX_SLOTS valid beatmap ids), or null
 */
export const parseBeatmapIds = (raw: string | null): number[] | null => {
  if ((raw ?? "").length > MAX_IDS_QUERY_LENGTH) return null;
  const ids = (raw ?? "").split(",").filter(Boolean).map(Number);
  const valid =
    ids.length > 0 &&
    ids.length <= MAX_SLOTS &&
    ids.every((id) => beatmapIdSchema.safeParse(id).success);
  return valid ? ids : null;
};

export const CROSS_SITE_REFUSED = `This request has to come from ${SITE.title} itself.`;

const SITE_ORIGIN = new URL(SITE.url).origin;
/** Sec-Fetch-Site values that mean another site (or a sibling *.haruhime.moe host) sent it. */
const FOREIGN_FETCH_SITES: ReadonlySet<string> = new Set(["cross-site", "same-site"]);

/**
 * @function refuseCrossSite
 * @param request {Request} a cookie-authenticated mutation that reads no body (a plain HTML form
 *        on another host could send it, and SameSite=Lax doesn't stop sibling subdomains)
 * @returns {Response | null} 403 when Origin is present and isn't this request's own origin or
 *          the site's, or when Sec-Fetch-Site says cross-site or same-site; otherwise null
 */
export const refuseCrossSite = (request: Request): Response | null => {
  const origin = request.headers.get("origin");
  const ownOrigin = new URL(request.url).origin;
  const foreignOrigin = origin !== null && origin !== ownOrigin && origin !== SITE_ORIGIN;
  const fetchSite = request.headers.get("sec-fetch-site");
  const foreignFetch = fetchSite !== null && FOREIGN_FETCH_SITES.has(fetchSite);
  return foreignOrigin || foreignFetch ? jsonError(403, CROSS_SITE_REFUSED) : null;
};
