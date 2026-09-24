/**
 * @file tests/helpers/hinai-server.ts
 * @desc MSW server for the hinai mirror: the batch endpoint from the recorded fixture (unknown ids
 *       omitted, like the real mirror), plus availability, downloads, our osu! fallback route, and
 *       our star-ratings route.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { HttpResponse, http } from "msw";
import { type SetupServer, setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import batch from "../fixtures/hinai/beatmaps-batch.json";
import { hinaiDownloadHandlers } from "./hinai-downloads";

export const HINAI_BATCH_URL = "https://mirror.hinamizawa.ai/api/v2/beatmaps";

export const hinaiBatchHandler = http.get(HINAI_BATCH_URL, ({ request }) => {
  const ids = new Set(
    (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).map(Number),
  );
  return HttpResponse.json(batch.filter((row) => ids.has(row.id)));
});

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
 * @returns {SetupServer} server with the batch handler; lifecycle hooks registered
 */
export const setupHinaiServer = (): SetupServer => {
  const server = setupServer(
    hinaiBatchHandler,
    osuFallbackHandler,
    starRatingsHandler,
    ...hinaiDownloadHandlers,
  );
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
};
