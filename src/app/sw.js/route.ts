/**
 * @file src/app/sw.js/route.ts
 * @desc The service worker at /sw.js: hashed build files from cache, an offline page when a
 *       page can't load, nothing else touched. Built once per deploy; the commit SHA is its
 *       version, so a deploy drops the old caches.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

import { serviceWorkerResponse } from "@haruhimemoe/next-kit/pwa";
import { PWA } from "@/constants/pwa";

/** Built once per deploy: the script only changes with the commit. */
export const dynamic = "force-static";

/**
 * @function GET
 * @returns {Response} the service worker script, never HTTP-cached
 */
export const GET = (): Response =>
  serviceWorkerResponse(PWA, { version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" });
