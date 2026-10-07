/**
 * @file tests/helpers/hinai-server.ts
 * @desc MSW server for the pack pages: the hinai mirror as @haruhimemoe/mirror/testing answers it
 *       (the recorded batch, availability and fake downloads), plus our own osu! fallback and
 *       star-ratings routes, which know nothing extra in component tests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { hinaiBatchHandler, hinaiDownloadHandlers } from "@haruhimemoe/mirror/testing";
import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse, http } from "msw";
import type { SetupServer } from "msw/node";

/** Our own osu! fallback route: in component tests it knows no extra maps. */
export const osuFallbackHandler = http.get("*/api/osu/beatmaps", () =>
  HttpResponse.json({ beatmaps: [] }),
);

/** Our star-ratings route: in component tests it rates nothing, so slots show no-mod ratings. */
export const starRatingsHandler = http.get("*/api/osu/star-ratings", () =>
  HttpResponse.json({ ratings: {}, pending: [] }),
);

/**
 * @function setupHinaiServer
 * @returns {SetupServer} server with the mirror and our two osu! routes; lifecycle hooks
 *          registered, and any request nothing handles fails the test
 */
export const setupHinaiServer = (): SetupServer =>
  setupMsw(hinaiBatchHandler, osuFallbackHandler, starRatingsHandler, ...hinaiDownloadHandlers);
