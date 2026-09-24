/**
 * @file src/app/api/auth/[...all]/route.ts
 * @desc better-auth handler: sign-in, OAuth callback, session, sign-out under /api/auth/*.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request));
