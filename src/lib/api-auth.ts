/**
 * @file src/lib/api-auth.ts
 * @desc withApiKey(): wraps every /api/v1 handler. Reads the Bearer key, counts failures per IP
 *       (auth-fail), then counts the request per user (api, and api-write for writes). Every
 *       response gets RateLimit-* headers and Cache-Control: no-store, a thrown error included
 *       (a JSON 500), and a 401 says `WWW-Authenticate: Bearer`. No CORS headers, ever: the API
 *       is for servers and bots.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { RATE_LIMITS } from "@/constants/api";
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
