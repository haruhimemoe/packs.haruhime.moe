/**
 * @file src/app/api/auth/[...all]/route.ts
 * @desc better-auth's handler: sign-in, OAuth callback, session and sign-out under /api/auth/*.
 *       Starting a sign-in (POST /api/auth/sign-in/*) is counted per IP in rate_limits first
 *       (RATE_LIMITS.signIn), since each start writes an OAuth state row and better-auth's own
 *       limiter only counts within one server instance.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { clientIp, rateLimitSubject } from "@haruhimemoe/next-kit/server";
import { toNextJsHandler } from "better-auth/next-js";
import { RATE_LIMITS } from "@/constants/api";
import { getAuth } from "@/lib/auth";
import { limiter } from "@/lib/rate-limit";

const SIGN_IN_PATH = "/api/auth/sign-in/";

const handlers = toNextJsHandler((request) => getAuth().handler(request));

/**
 * @function GET
 * @param request {Request} a better-auth GET (session, OAuth callback)
 * @returns {Promise<Response>} better-auth's answer
 */
export const GET = handlers.GET;

/**
 * @function POST
 * @param request {Request} a better-auth POST (sign-in, sign-out)
 * @returns {Promise<Response>} a no-store 429 when this IP started too many sign-ins this minute,
 *          else better-auth's answer
 */
export const POST = async (request: Request): Promise<Response> => {
  if (new URL(request.url).pathname.startsWith(SIGN_IN_PATH)) {
    const subject = rateLimitSubject(clientIp(request.headers));
    const limited = await limiter.refuseOverLimit(RATE_LIMITS.signIn, subject);
    if (limited) return limited;
  }
  return handlers.POST(request);
};
