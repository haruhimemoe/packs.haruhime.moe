/**
 * @file tests/helpers/stats-lookups.ts
 * @desc MSW for the lookups pack stats make on the server: the hinai mirror's metadata batch, and
 *       osu!'s token, beatmaps and attributes endpoints. Each test sets which maps each side knows,
 *       which ratings osu! gives (or refuses), and whether a side is down; the calls are recorded.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { HINAI_BATCH_URL } from "./hinai-server";

export type RowOverrides = {
  mode?: "osu" | "taiko" | "fruits" | "mania";
  difficulty_rating?: number;
  bpm?: number;
  total_length?: number;
};

/**
 * @function beatmapRow
 * @param id {number} difficulty id
 * @param overrides {RowOverrides} ruleset, stars, BPM, length
 * @returns {object} an osu!-shaped difficulty row (the mirror and osu! both send this shape)
 */
export const beatmapRow = (id: number, overrides: RowOverrides = {}) => ({
  id,
  beatmapset_id: id + 1000,
  mode: "osu",
  version: "Insane",
  difficulty_rating: 5,
  cs: 4,
  ar: 9,
  accuracy: 8,
  drain: 6,
  bpm: 180,
  total_length: 120,
  checksum: null,
  beatmapset: { artist: "Artist", title: "Title", creator: "Mapper", user_id: 2 },
  ...overrides,
});

type Row = ReturnType<typeof beatmapRow>;

export type StatsLookups = {
  /** Maps the mirror knows. */
  mirror: Map<number, Row>;
  /** Maps osu! knows (asked only for what the mirror lacks). */
  osu: Map<number, Row>;
  /** osu! ratings by pair key ("5:DT"); "refuse" answers 422 (osu! won't rate it). */
  ratings: Map<string, number | "refuse">;
  mirrorDown: boolean;
  osuDown: boolean;
  calls: { mirror: string[]; osuBeatmaps: string[]; attributes: string[] };
};

const ids = (value: string | null): number[] =>
  (value ?? "").split(",").filter(Boolean).map(Number);

/**
 * @function setupStatsLookups
 * @returns {StatsLookups} the state the handlers read; reset before each test (the mirror and
 *          osu! know nothing, nothing is down, no calls)
 */
export const setupStatsLookups = (): StatsLookups => {
  const state: StatsLookups = {
    mirror: new Map(),
    osu: new Map(),
    ratings: new Map(),
    mirrorDown: false,
    osuDown: false,
    calls: { mirror: [], osuBeatmaps: [], attributes: [] },
  };
  const server = setupServer(
    http.get(HINAI_BATCH_URL, ({ request }) => {
      const asked = ids(new URL(request.url).searchParams.get("ids"));
      state.calls.mirror.push(asked.join(","));
      if (state.mirrorDown) return new HttpResponse(null, { status: 503 });
      return HttpResponse.json(asked.flatMap((id) => state.mirror.get(id) ?? []));
    }),
    http.post("https://osu.ppy.sh/oauth/token", () =>
      HttpResponse.json({ token_type: "Bearer", expires_in: 86400, access_token: "t" }),
    ),
    http.get("https://osu.ppy.sh/api/v2/beatmaps", ({ request }) => {
      const asked = new URL(request.url).searchParams.getAll("ids[]").map(Number);
      state.calls.osuBeatmaps.push(asked.join(","));
      if (state.osuDown) return new HttpResponse(null, { status: 500 });
      return HttpResponse.json({ beatmaps: asked.flatMap((id) => state.osu.get(id) ?? []) });
    }),
    http.post("https://osu.ppy.sh/api/v2/beatmaps/:id/attributes", async ({ params, request }) => {
      const { mods } = (await request.json()) as { mods: string[] };
      const key = `${String(params.id)}:${mods.join("")}`;
      state.calls.attributes.push(key);
      if (state.osuDown) return new HttpResponse(null, { status: 500 });
      const rating = state.ratings.get(key);
      if (rating === undefined || rating === "refuse") {
        return new HttpResponse(null, { status: 422 });
      }
      return HttpResponse.json({ attributes: { star_rating: rating } });
    }),
  );
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    state.mirror.clear();
    state.osu.clear();
    state.ratings.clear();
    state.mirrorDown = false;
    state.osuDown = false;
    state.calls = { mirror: [], osuBeatmaps: [], attributes: [] };
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return state;
};

/**
 * @function onMirror
 * @param state {StatsLookups} the lookups
 * @param rows {Row[]} rows the mirror should know
 * @returns {void} adds them to the mirror
 */
export const onMirror = (state: StatsLookups, ...rows: Row[]): void => {
  for (const row of rows) state.mirror.set(row.id, row);
};
