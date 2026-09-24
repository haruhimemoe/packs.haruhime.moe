/**
 * @file tests/unit/lib/beatmaps/lookup.test.ts
 * @desc Browser beatmap lookup: hinai first, the osu! fallback route for what's missing, ids osu!
 *       couldn't check yet carried as unchecked (never missing), and a fallback that never breaks
 *       the pool when it fails.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type BeatmapSource, fetchOsuFallback, withFallback } from "@/lib/beatmaps/lookup";

const meta = (id: number): BeatmapMeta => ({
  beatmapId: id,
  beatmapsetId: id + 1000,
  mode: "osu",
  title: `t${id}`,
  artist: "a",
  version: "v",
  creator: "c",
  creatorId: null,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5,
  checksum: null,
});

const primary: BeatmapSource = {
  async getBeatmaps(ids) {
    const found = new Map(ids.filter((id) => id < 100).map((id) => [id, meta(id)]));
    return { found, missing: ids.filter((id) => id >= 100) };
  },
};

describe("withFallback", () => {
  it("skips the fallback when nothing is missing", async () => {
    const fallback = vi.fn(async () => ({ beatmaps: [], unchecked: [] }));
    const result = await withFallback(primary, fallback).getBeatmaps([1, 2]);
    expect(fallback).not.toHaveBeenCalled();
    expect(result.missing).toEqual([]);
    expect(result.unchecked).toEqual([]);
  });

  it("fills missing ids from the fallback and ignores extras", async () => {
    const fallback = vi.fn(async () => ({ beatmaps: [meta(100), meta(7)], unchecked: [] }));
    const result = await withFallback(primary, fallback).getBeatmaps([1, 100, 200]);
    expect(fallback).toHaveBeenCalledWith([100, 200]);
    expect([...result.found.keys()].sort((a, b) => a - b)).toEqual([1, 100]);
    expect(result.missing).toEqual([200]);
    expect(result.unchecked).toEqual([]);
  });

  it("reports ids osu! couldn't check yet as unchecked, never missing", async () => {
    const fallback = vi.fn(async () => ({ beatmaps: [meta(100)], unchecked: [200, 7] }));
    const result = await withFallback(primary, fallback).getBeatmaps([1, 100, 200, 300]);
    expect([...result.found.keys()].sort((a, b) => a - b)).toEqual([1, 100]);
    expect(result.missing).toEqual([300]);
    // 7 was never asked about: only ids the fallback was asked for count.
    expect(result.unchecked).toEqual([200]);
  });
});

describe("fetchOsuFallback", () => {
  const URL_ = "http://localhost/api/osu/beatmaps";
  let seen: string | null = null;
  const server = setupServer(
    http.get(URL_, ({ request }) => {
      seen = new URL(request.url).searchParams.get("ids");
      return HttpResponse.json({ beatmaps: [meta(300)] });
    }),
  );
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const NOTHING = { beatmaps: [], unchecked: [] };

  it("asks with sorted ids (better CDN hits) and parses the answer", async () => {
    expect(await fetchOsuFallback([300, 5], { baseUrl: "http://localhost" })).toEqual({
      beatmaps: [meta(300)],
      unchecked: [],
    });
    expect(seen).toBe("5,300");
  });

  it("reads the ids osu! couldn't check yet", async () => {
    server.use(http.get(URL_, () => HttpResponse.json({ beatmaps: [meta(300)], unchecked: [5] })));
    expect(await fetchOsuFallback([300, 5], { baseUrl: "http://localhost" })).toEqual({
      beatmaps: [meta(300)],
      unchecked: [5],
    });
  });

  it("marks every id unchecked (retryable, never missing) when the route is rate limited", async () => {
    server.use(http.get(URL_, () => HttpResponse.json({}, { status: 429 })));
    expect(await fetchOsuFallback([300, 5], { baseUrl: "http://localhost" })).toEqual({
      beatmaps: [],
      unchecked: [300, 5],
    });
  });

  it("sends nothing for no ids", async () => {
    seen = null;
    expect(await fetchOsuFallback([], { baseUrl: "http://localhost" })).toEqual(NOTHING);
    expect(seen).toBeNull();
  });

  it.each([
    [
      "an error status",
      () => HttpResponse.json({ error: { code: "upstream_error", message: "x" } }, { status: 502 }),
    ],
    ["a bad shape", () => HttpResponse.json({ beatmaps: [{ nope: 1 }] })],
    ["a network failure", () => HttpResponse.error()],
  ])("returns nothing on %s", async (_label, resolver) => {
    server.use(http.get(URL_, resolver));
    expect(await fetchOsuFallback([1], { baseUrl: "http://localhost" })).toEqual(NOTHING);
  });
});
