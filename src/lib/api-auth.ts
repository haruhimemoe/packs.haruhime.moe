/**
 * @file src/lib/api-auth.ts
 * @desc withApiKey(): wraps every /api/v1 handler that needs a key. Reads the Bearer key, counts
 *       failures per IP (auth-fail), then counts the request per user (api, and api-write for
 *       writes). Every response gets RateLimit-* headers and Cache-Control: no-store, a thrown
 *       error included (a JSON 500), and a 401 says `WWW-Authenticate: Bearer`.
 *       withPublicApi(): wraps the public reads that need no key (map usage). Counts each request
 *       per IP; a success keeps the Cache-Control its handler set (the CDN may answer repeats, so
 *       it carries no RateLimit-* headers), and everything else is no-store, a 429 with every
 *       rate-limit header. No CORS headers, ever: the API is for servers and bots.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { RATE_LIMITS, type RateLimitRule } from "@/constants/api";
import { jsonError } from "@/lib/api";
import { bearerToken } from "@/lib/api-key";
import {
  hitRateLimit,
  type RateLimitResult,
  rateLimitHeaders,
  tooManyRequests,
  windowFor,
  withHeaders,
} from "@/lib/rate-limit";
import { type ApiCaller, authenticateApiKey } from "@/services/api-keys";
import { clientIp, rateLimitSubject } from "@/utils/client-ip";

export const MISSING_KEY = "Send your API key in the Authorization header: Bearer hpk_…";
export const INVALID_KEY = "That API key isn't valid. It may have been revoked or replaced.";
export const SERVER_ERROR = "Something went wrong on our end. Try again in a minute.";

const WRITE_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type ApiRouteHandler<C> = (request: Request, caller: ApiCaller, context: C) => Promise<Response>;

const finish = (response: Response, limit: RateLimitResult): Response =>
  withHeaders(response, { ...rateLimitHeaders(limit), "Cache-Control": "no-store" });

const unauthorized = (response: Response): Response =>
  withHeaders(response, { "WWW-Authenticate": "Bearer" });

/** Nothing counted yet (the key lookup threw): the per-account limit, untouched. */
const uncounted = (): RateLimitResult => ({
  allowed: true,
  limit: RATE_LIMITS.api.limit,
  remaining: RATE_LIMITS.api.limit,
  resetSeconds: windowFor(RATE_LIMITS.api, Date.now()).resetSeconds,
});

const serverError = (error: unknown, limit: RateLimitResult): Response => {
  console.error("api: request failed", error);
  return finish(jsonError(500, SERVER_ERROR), limit);
};

/**
 * @function withApiKey
 * @param handler {ApiRouteHandler<C>} runs only for a valid key within its limits
 * @returns {(request: Request, context: C) => Promise<Response>} the route handler Next calls
 */
export const withApiKey =
  <C = unknown>(handler: ApiRouteHandler<C>) =>
  async (request: Request, context: C): Promise<Response> => {
    const token = bearerToken(request.headers);
    let caller: ApiCaller | null;
    try {
      caller = token ? await authenticateApiKey(token) : null;
    } catch (error) {
      return serverError(error, uncounted());
    }
    if (!caller) {
      const failures = await hitRateLimit(
        RATE_LIMITS.authFail,
        rateLimitSubject(clientIp(request.headers)),
      );
      if (!failures.allowed) return finish(tooManyRequests(failures), failures);
      return finish(
        unauthorized(
          token ? jsonError(401, INVALID_KEY, "invalid_api_key") : jsonError(401, MISSING_KEY),
        ),
        failures,
      );
    }
    const requests = await hitRateLimit(RATE_LIMITS.api, caller.id);
    if (!requests.allowed) return finish(tooManyRequests(requests), requests);
    let shown = requests;
    if (WRITE_METHODS.has(request.method)) {
      const writes = await hitRateLimit(RATE_LIMITS.apiWrite, caller.id);
      if (!writes.allowed) return finish(tooManyRequests(writes), writes);
      // Show whichever counter runs out first.
      if (writes.remaining < requests.remaining) shown = writes;
    }
    try {
      return finish(await handler(request, caller, context), shown);
    } catch (error) {
      return serverError(error, shown);
    }
  };

type PublicRouteHandler<C> = (request: Request, context: C) => Promise<Response>;

/**
 * @function withPublicApi
 * @param rule {RateLimitRule} the per-IP limit (IPv6 by its /64)
 * @param handler {PublicRouteHandler<C>} the read; it sets Cache-Control on an answer the CDN may
 *        keep
 * @returns {(request: Request, context: C) => Promise<Response>} the route handler Next calls:
 *          429 with Retry-After over the limit, a JSON 500 when the handler throws, and
 *          Cache-Control: no-store on everything but a success that set its own
 */
export const withPublicApi =
  <C = unknown>(rule: RateLimitRule, handler: PublicRouteHandler<C>) =>
  async (request: Request, context: C): Promise<Response> => {
    const limit = await hitRateLimit(rule, rateLimitSubject(clientIp(request.headers)));
    if (!limit.allowed) {
      return withHeaders(tooManyRequests(limit), { "Cache-Control": "no-store" });
    }
    let response: Response;
    try {
      response = await handler(request, context);
    } catch (error) {
      console.error("api: request failed", error);
      response = jsonError(500, SERVER_ERROR);
    }
    if (!response.ok || !response.headers.has("Cache-Control")) {
      response.headers.set("Cache-Control", "no-store");
    }
    return response;
  };
