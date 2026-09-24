/**
 * @file tests/components/hooks/useMapUsage.test.tsx
 * @desc useMapUsage with a fake fetcher and fake timers: one request for a whole pool, ids
 *       sorted and each once; nothing for an empty pool; only new maps asked for after a change,
 *       nothing after a removal; the editor delay (one request after a burst of changes); the
 *       pack's own entries left out; a failed request shows nothing and the next change asks
 *       again; stopping on unmount. Plus fetchMapUsage.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMapUsage, type MapUsageFetcher, useMapUsage } from "@/hooks/useMapUsage";
import type { MapUsageEntry } from "@/schemas/map-usage";

const entry = (slug: string, slot = "NM1"): MapUsageEntry => ({
  slug,
  tournament: "Spring Cup",
  round: "Finals",
  year: 2024,
  badged: null,
  slot,
  mods: "NM",
});

/** Answers every id, with the entries given for some of them. */
const fetcherWith = (known: Record<number, MapUsageEntry[]> = {}) =>
  vi.fn<MapUsageFetcher>(async (ids) => ({
    beatmaps: ids.map((beatmapId) => {
      const entries = known[beatmapId] ?? [];
      return { beatmapId, count: new Set(entries.map((e) => e.slug)).size, entries };
    }),
  }));

const settle = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useMapUsage", () => {
  it("asks once for the whole pool, ids sorted and each once", async () => {
    const fetchUsage = fetcherWith({ 2: [entry("aaaaaaaaaa")] });
    const { result } = renderHook(() => useMapUsage([3, 1, 2, 3], { fetchUsage }));
    expect(result.current(2)).toEqual([]);
    await settle();
    expect(fetchUsage).toHaveBeenCalledTimes(1);
    expect(fetchUsage).toHaveBeenCalledWith([1, 2, 3]);
    expect(result.current(2)).toEqual([entry("aaaaaaaaaa")]);
    expect(result.current(1)).toEqual([]);
    expect(result.current(99)).toEqual([]);
  });

  it("asks nothing for an empty pool", async () => {
    const fetchUsage = fetcherWith();
    renderHook(() => useMapUsage([], { fetchUsage }));
    await settle();
    expect(fetchUsage).not.toHaveBeenCalled();
  });

  it("leaves out the pack's own entries", async () => {
    const fetchUsage = fetcherWith({
      1: [entry("aaaaaaaaaa"), entry("bbbbbbbbbb"), entry("aaaaaaaaaa", "TB1")],
    });
    const { result } = renderHook(() =>
      useMapUsage([1], { fetchUsage, excludeSlug: "aaaaaaaaaa" }),
    );
    await settle();
    expect(result.current(1)).toEqual([entry("bbbbbbbbbb")]);
  });

  it("asks only for new maps after a change, and nothing after a removal or reorder", async () => {
    const fetchUsage = fetcherWith({ 4: [entry("aaaaaaaaaa")] });
    const { result, rerender } = renderHook(({ ids }) => useMapUsage(ids, { fetchUsage }), {
      initialProps: { ids: [1, 2] },
    });
    await settle();
    rerender({ ids: [2, 1, 4] });
    await settle();
    expect(fetchUsage.mock.calls).toEqual([[[1, 2]], [[4]]]);
    expect(result.current(4)).toEqual([entry("aaaaaaaaaa")]);
    rerender({ ids: [4, 1] });
    await settle();
    expect(fetchUsage).toHaveBeenCalledTimes(2);
  });

  it("waits for the pool to hold still in the editor, then asks once", async () => {
    const fetchUsage = fetcherWith();
    const { rerender } = renderHook(({ ids }) => useMapUsage(ids, { fetchUsage, delayMs: 1500 }), {
      initialProps: { ids: [1] },
    });
    await settle(1000);
    rerender({ ids: [1, 2] });
    await settle(1000);
    rerender({ ids: [1, 2, 3] });
    await settle(1499);
    expect(fetchUsage).not.toHaveBeenCalled();
    await settle(1);
    expect(fetchUsage.mock.calls).toEqual([[[1, 2, 3]]]);
  });

  it("shows nothing when the request fails, and asks again on the next change", async () => {
    const fetchUsage = vi
      .fn<MapUsageFetcher>()
      .mockRejectedValueOnce(new Error("Map usage answered 429."))
      .mockImplementation(fetcherWith({ 1: [entry("aaaaaaaaaa")] }));
    const { result, rerender } = renderHook(({ ids }) => useMapUsage(ids, { fetchUsage }), {
      initialProps: { ids: [1] },
    });
    await settle();
    expect(result.current(1)).toEqual([]);
    rerender({ ids: [1, 2] });
    await settle();
    expect(fetchUsage.mock.calls).toEqual([[[1]], [[1, 2]]]);
    expect(result.current(1)).toEqual([entry("aaaaaaaaaa")]);
  });

  it("drops an answer that arrives after unmount", async () => {
    let resolve: (() => void) | undefined;
    const fetchUsage = vi.fn<MapUsageFetcher>(
      () =>
        new Promise((done) => {
          resolve = () => done({ beatmaps: [] });
        }),
    );
    const { unmount } = renderHook(() => useMapUsage([1], { fetchUsage }));
    await settle();
    unmount();
    resolve?.();
    await settle();
    expect(fetchUsage).toHaveBeenCalledTimes(1);
  });

  it("never asks when unmounted before the delay ends", async () => {
    const fetchUsage = fetcherWith();
    const { unmount } = renderHook(() => useMapUsage([1], { fetchUsage, delayMs: 1500 }));
    unmount();
    await settle(2000);
    expect(fetchUsage).not.toHaveBeenCalled();
  });
});

describe("fetchMapUsage", () => {
  it("asks our usage route with the ids and parses the answer", async () => {
    const body = { beatmaps: [{ beatmapId: 75, count: 1, entries: [entry("aaaaaaaaaa")] }] };
    const doFetch = vi.fn(async () => Response.json(body));
    expect(
      await fetchMapUsage([75, 76], { baseUrl: "https://packs.test", fetch: doFetch }),
    ).toEqual(body);
    expect(doFetch).toHaveBeenCalledWith("https://packs.test/api/v1/beatmaps/usage?ids=75,76");
  });

  it("rejects on an error status or a body it can't read", async () => {
    await expect(
      fetchMapUsage([75], { fetch: async () => new Response("", { status: 429 }) }),
    ).rejects.toThrow("Map usage answered 429.");
    await expect(
      fetchMapUsage([75], { fetch: async () => Response.json({ beatmaps: [{ count: -1 }] }) }),
    ).rejects.toThrow();
  });
});
