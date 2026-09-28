/**
 * @file src/lib/api.ts
 * @desc packs' route helpers over @haruhimemoe/next-kit/server: its messages, pack bodies (which
 *       keep "That pack is too large."), ?ids= beatmap lists (strict: 1 to MAX_SLOTS ids, digits
 *       only) and the cross-site guard for this site. jsonError, parseJsonBody and the rest come
 *       from next-kit itself.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  crossSiteMessage,
  type ParsedBody,
  parseIdList,
  parseJsonBody,
  refuseCrossSite as refuseForeign,
} from "@haruhimemoe/next-kit/server";
import { MAX_SLOTS } from "@haruhimemoe/pool";
import type { z } from "zod";
import { SITE } from "@/constants/site";
import { beatmapIdSchema } from "@/schemas/pack";

export const SIGN_IN_REQUIRED = "Sign in with osu! to save packs.";
export const PACK_NOT_FOUND = "Pack not found.";
export const PACK_TOO_LARGE = "That pack is too large.";
export const BAD_PAGE = "Use a page number from 1 to 999999.";
export const BAD_BEATMAP_IDS = `Pass 1 to ${MAX_SLOTS} beatmap ids as ?ids=1,2,3.`;
export const CROSS_SITE_REFUSED = crossSiteMessage(SITE.title);

/**
 * @function parsePackBody
 * @param request {Request} a save (POST or PUT of a pack)
 * @param schema {z.ZodType} the pack input schema
 * @returns {Promise<ParsedBody<z.output<T>>>} the parsed pack, or a 415, 413 ("That pack is too
 *          large.") or 400 response to send back
 */
export const parsePackBody = <T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<ParsedBody<z.output<T>>> => parseJsonBody(request, schema, { tooLarge: PACK_TOO_LARGE });

/**
 * @function parseBeatmapIds
 * @param raw {string | null} the ?ids= value
 * @returns {number[] | null} 1 to MAX_SLOTS valid beatmap ids, or null for anything else (an empty
 *          part, spaces, hex or exponents included)
 */
export const parseBeatmapIds = (raw: string | null): number[] | null =>
  parseIdList(raw, {
    max: MAX_SLOTS,
    isValid: (id) => beatmapIdSchema.safeParse(id).success,
  });

/**
 * @function refuseCrossSite
 * @param request {Request} a cookie-authenticated mutation that reads no body
 * @returns {Response | null} a 403 when it came from another site, else null
 */
export const refuseCrossSite = (request: Request): Response | null =>
  refuseForeign(request, { siteUrl: SITE.url, siteTitle: SITE.title });
