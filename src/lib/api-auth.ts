/**
 * @file src/lib/api-auth.ts
 * @desc withApiKey(): wraps every /api/v1 handler. Reads the Bearer key, counts failures per IP
 *       (auth-fail), then counts the request per user (api, and api-write for writes). Every
 *       response gets RateLimit-* headers and Cache-Control: no-store, a thrown error included
 *       (a JSON 500), and a 401 says `WWW-Authenticate: Bearer`. No CORS headers, ever: the API
 *       is for servers and bots. Built on @haruhimemoe/next-kit's api-keys guard.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Sat Oct 3, 2026
 */

import "server-only";
import { createApiKeyGuard } from "@haruhimemoe/next-kit/api-keys";
import { RATE_LIMITS } from "@/constants/api";
import { apiKeys } from "@/lib/api-keys";
import { limiter } from "@/lib/rate-limit";
import { resolveApiCaller } from "@/services/api-keys";

export const MISSING_KEY = "Send your API key in the Authorization header: Bearer hpk_…";
export const INVALID_KEY = "That API key isn't valid. It may have been revoked or replaced.";
export { API_SERVER_ERROR as SERVER_ERROR } from "@haruhimemoe/next-kit/api-keys";

export const withApiKey = createApiKeyGuard({
  store: apiKeys,
  limiter,
  resolveCaller: resolveApiCaller,
  messages: { missing: MISSING_KEY, invalid: INVALID_KEY },
  limits: RATE_LIMITS,
});
