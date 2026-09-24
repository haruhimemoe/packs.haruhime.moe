/**
 * @file tests/components/hooks/useModdedStarRatings.test.tsx
 * @desc useModdedStarRatings with a fake fetcher and fake timers: the canonical query, forced and
 *       freemod results, mania, waiting for metadata, the editor delay, retries every 5 s while
 *       pending (at most 12), giving up, refused pairs, network errors, stopping on unmount, and
 *       no request when everything is known. Plus fetchStarRatings and usePoolStarRatings.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { NO_MODS, type SlotMods } from "@haruhimemoe/pool";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetaState } from "@/hooks/beatmapMetaState";
import {
  fetchStarRatings,
  type StarRatingsFetcher,
  useModdedStarRatings,
  usePoolStarRatings,
} from "@/hooks/useModdedStarRatings";
import { type PoolSlot, slotKey } from "@/schemas/pack";
import type { StarRatingsResponse } from "@/schemas/star-ratings";

const meta = (beatmapId: number, overrides: Partial<BeatmapMeta> = {}): BeatmapMeta => ({
  beatmapId,
  beatmapsetId: beatmapId,
  mode: "osu",
  title: "t",
  artist: "a",
  version: "v",
  creator: "c",
  creatorId: 1,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 5,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5,
  checksum: null,
  ...overrides,
});
const metaGetter = (metas: BeatmapMeta[]) => {
  const byId = new Map(metas.map((m) => [m.beatmapId, m]));
  return (id: number): MetaState => {
    const m = byId.get(id);
    return m ? { status: "found", meta: m } : { status: "loading" };
  };
};
const slot = (mod: string | null, index: number, beatmapId: number): PoolSlot => ({
  mod,
  index,
  beatmapId,
});
const modsFor = (entries: [PoolSlot, SlotMods][]) =>
  new Map(entries.map(([s, m]) => [slotKey(s), m]));
const HD: SlotMods = { kind: "forced", set: ["HD"] };
const FREE: SlotMods = { kind: "free" };
/** A fetcher that answers from a list of responses in turn (the last one repeats). */
const answers = (...responses: (StarRatingsResponse | Error)[]) => {
  let i = 0;
  const fetcher = vi.fn<StarRatingsFetcher>(async () => {
    const next = responses[Math.min(i++, responses.length - 1)] as StarRatingsResponse | Error;
    if (next instanceof Error) throw next;
    return next;
  });
  return fetcher;
};
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useModdedStarRatings", () => {
  it("asks for the pool's pairs in canonical order and fills in each slot", async () => {
    const fetchRatings = answers({
      ratings: { "7:HD": 7.1, "8:EZ": 7.5, "8:HD": 8.1, "8:HDHR": 8.3, "8:HR": 8.2 },
      pending: [],
    });
    const hd = slot("HD", 1, 7);
    const fm = slot("FM", 1, 8);
    const get = metaGetter([meta(7), meta(8)]);
    const mods = modsFor([
      [hd, HD],
      [fm, FREE],
    ]);
    const { result } = renderHook(() =>
      useModdedStarRatings([hd, fm], get, mods, { fetchRatings }),
    );
    await advance(0);
    expect(fetchRatings).toHaveBeenCalledExactlyOnceWith("7:HD,8:EZ,8:HD,8:HDHR,8:HR");
    expect(result.current.get("b:HD#1")).toEqual([{ mods: "HD", stars: 7.1 }]);
    expect(result.current.get("b:FM#1")).toEqual([
      { mods: "HD", stars: 8.1 },
      { mods: "HR", stars: 8.2 },
      { mods: "HDHR", stars: 8.3 },
      { mods: "EZ", stars: 7.5 },
    ]);
  });

  it("asks only for HD on a mania freemod slot", async () => {
    const fetchRatings = answers({ ratings: { "8:HD": 3 }, pending: [] });
    const fm = slot("FM", 1, 8);
    const get = metaGetter([meta(8, { mode: "mania" })]);
    const mods = modsFor([[fm, FREE]]);
    renderHook(() => useModdedStarRatings([fm], get, mods, { fetchRatings }));
    await advance(0);
    expect(fetchRatings).toHaveBeenCalledExactlyOnceWith("8:HD");
  });

  it("sends nothing when no slot has mods", async () => {
    const fetchRatings = answers({ ratings: {}, pending: [] });
    const nm = slot("NM", 1, 7);
    const get = metaGetter([meta(7)]);
    const mods = modsFor([[nm, NO_MODS]]);
    renderHook(() => useModdedStarRatings([nm], get, mods, { fetchRatings }));
    await advance(10_000);
    expect(fetchRatings).not.toHaveBeenCalled();
  });

  it("waits for metadata", async () => {
    const fetchRatings = answers({ ratings: { "7:HD": 7.1 }, pending: [] });
    const hd = slot("HD", 1, 7);
    const mods = modsFor([[hd, HD]]);
    const { rerender } = renderHook(
      ({ get }) => useModdedStarRatings([hd], get, mods, { fetchRatings }),
      { initialProps: { get: metaGetter([]) } },
    );
    await advance(1000);
    expect(fetchRatings).not.toHaveBeenCalled();
    rerender({ get: metaGetter([meta(7)]) });
    await advance(0);
    expect(fetchRatings).toHaveBeenCalledOnce();
  });

  it("in the editor, asks 1.5 s after the last change, once", async () => {
    const fetchRatings = answers({ ratings: {}, pending: [] });
    const a = slot("HD", 1, 7);
    const b = slot("HD", 2, 8);
    const get = metaGetter([meta(7), meta(8)]);
    const { rerender } = renderHook(
      ({ slots, mods }) => useModdedStarRatings(slots, get, mods, { delayMs: 1500, fetchRatings }),
      { initialProps: { slots: [a], mods: modsFor([[a, HD]]) } },
    );
    await advance(1000);
    rerender({
      slots: [a, b],
      mods: modsFor([
        [a, HD],
        [b, HD],
      ]),
    });
    await advance(1499);
    expect(fetchRatings).not.toHaveBeenCalled();
    await advance(1);
    expect(fetchRatings).toHaveBeenCalledExactlyOnceWith("7:HD,8:HD");
  });

  it("asks again every 5 s while pairs are pending", async () => {
    const fetchRatings = answers(
      { ratings: { "7:HD": 7.1 }, pending: ["8:HD"] },
      { ratings: { "7:HD": 7.1 }, pending: ["8:HD"] },
      { ratings: { "7:HD": 7.1, "8:HD": 8.1 }, pending: [] },
    );
    const a = slot("HD", 1, 7);
    const b = slot("HD", 2, 8);
    const get = metaGetter([meta(7), meta(8)]);
    const mods = modsFor([
      [a, HD],
      [b, HD],
    ]);
    const { result } = renderHook(() => useModdedStarRatings([a, b], get, mods, { fetchRatings }));
    await advance(0);
    expect(result.current.get("b:HD#1")).toEqual([{ mods: "HD", stars: 7.1 }]);
    expect(result.current.has("b:HD#2")).toBe(false);
    await advance(4999);
    expect(fetchRatings).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchRatings).toHaveBeenCalledTimes(2);
    await advance(5000);
    expect(result.current.get("b:HD#2")).toEqual([{ mods: "HD", stars: 8.1 }]);
    await advance(60_000);
    expect(fetchRatings).toHaveBeenCalledTimes(3);
  });

  it("gives up after 12 retries and shows the rating without mods", async () => {
    const fetchRatings = answers({ ratings: {}, pending: ["7:HD"] });
    const hd = slot("HD", 1, 7);
    const get = metaGetter([meta(7)]);
    const mods = modsFor([[hd, HD]]);
    const { result } = renderHook(() => useModdedStarRatings([hd], get, mods, { fetchRatings }));
    await advance(0);
    await advance(12 * 5000);
    expect(fetchRatings).toHaveBeenCalledTimes(13);
    expect(result.current.get("b:HD#1")).toEqual([]);
    await advance(60_000);
    expect(fetchRatings).toHaveBeenCalledTimes(13);
  });

  it("fails a pair the server left out, without retrying", async () => {
    const fetchRatings = answers({ ratings: {}, pending: [] });
    const hd = slot("HD", 1, 7);
    const get = metaGetter([meta(7)]);
    const mods = modsFor([[hd, HD]]);
    const { result } = renderHook(() => useModdedStarRatings([hd], get, mods, { fetchRatings }));
    await advance(0);
    expect(result.current.get("b:HD#1")).toEqual([]);
    await advance(60_000);
    expect(fetchRatings).toHaveBeenCalledOnce();
  });

  it("treats a network error as pending", async () => {
    const fetchRatings = answers(new Error("offline"), { ratings: { "7:HD": 7.1 }, pending: [] });
    const hd = slot("HD", 1, 7);
    const get = metaGetter([meta(7)]);
    const mods = modsFor([[hd, HD]]);
    const { result } = renderHook(() => useModdedStarRatings([hd], get, mods, { fetchRatings }));
    await advance(0);
    expect(result.current.has("b:HD#1")).toBe(false);
    await advance(5000);
    expect(result.current.get("b:HD#1")).toEqual([{ mods: "HD", stars: 7.1 }]);
  });

  it("stops asking when the page goes away", async () => {
    const fetchRatings = answers({ ratings: {}, pending: ["7:HD"] });
    const hd = slot("HD", 1, 7);
    const get = metaGetter([meta(7)]);
    const mods = modsFor([[hd, HD]]);
    const { unmount } = renderHook(() => useModdedStarRatings([hd], get, mods, { fetchRatings }));
    await advance(0);
    unmount();
    await advance(60_000);
    expect(fetchRatings).toHaveBeenCalledOnce();
  });

  it("sends nothing when every pair is already known", async () => {
    const fetchRatings = answers({ ratings: { "7:HD": 7.1, "8:HD": 8.1 }, pending: [] });
    const a = slot("HD", 1, 7);
    const b = slot("HD", 2, 8);
    const get = metaGetter([meta(7), meta(8)]);
    const both = modsFor([
      [a, HD],
      [b, HD],
    ]);
    const { rerender } = renderHook(
      ({ slots }) => useModdedStarRatings(slots, get, both, { fetchRatings }),
      { initialProps: { slots: [a, b] } },
    );
    await advance(0);
    rerender({ slots: [a] });
    await advance(10_000);
    expect(fetchRatings).toHaveBeenCalledOnce();
  });
});

describe("usePoolStarRatings", () => {
  it("derives each slot's mods from the pack and counts forced slots with their mods", async () => {
    const fetchRatings = answers({
      ratings: { "7:EZ": 4.5, "8:EZ": 7.5, "8:HD": 8.1, "8:HDHR": 8.3, "8:HR": 8.2 },
      pending: [],
    });
    const pack = {
      slots: [slot("EZ", 1, 7), slot("FM", 1, 8)],
      buckets: [
        { code: "NM" as const },
        { code: "HD" as const },
        { code: "HR" as const },
        { code: "DT" as const },
        { code: "FM" as const },
        { code: "EZ", color: 0, mods: { kind: "forced" as const, set: ["EZ" as const] } },
        { code: "TB" as const },
      ],
    };
    const get = metaGetter([meta(7), meta(8)]);
    const { result } = renderHook(() => usePoolStarRatings(pack, get, { fetchRatings }));
    expect(result.current.modsBySlot.get("b:EZ#1")).toEqual({ kind: "forced", set: ["EZ"] });
    await advance(0);
    expect(result.current.starsOf(pack.slots[0] as PoolSlot, meta(7))).toBe(4.5);
    expect(result.current.starsOf(pack.slots[1] as PoolSlot, meta(8))).toBe(5);
  });
});

describe("fetchStarRatings", () => {
  const respond = (body: unknown, status = 200) =>
    vi.fn(async (_input: string) => Response.json(body, { status }));

  it("asks our route with the query as given", async () => {
    const fetch = respond({ ratings: { "7:HD": 7.1 }, pending: [] });
    const body = await fetchStarRatings("7:HD,7:HDHR", { baseUrl: "https://packs.test", fetch });
    expect(fetch).toHaveBeenCalledWith("https://packs.test/api/osu/star-ratings?q=7:HD,7:HDHR");
    expect(body).toEqual({ ratings: { "7:HD": 7.1 }, pending: [] });
  });

  it("rejects an error status and an unreadable body", async () => {
    await expect(
      fetchStarRatings("7:HD", {
        baseUrl: "",
        fetch: respond({ error: { code: "bad_request", message: "x" } }, 400),
      }),
    ).rejects.toThrow();
    await expect(
      fetchStarRatings("7:HD", { baseUrl: "", fetch: respond({ nope: true }) }),
    ).rejects.toThrow();
  });
});
