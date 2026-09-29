/**
 * @file tests/unit/lib/page-meta.test.ts
 * @desc lookupPageMeta: the pack page's mirror-only lookup, one call per 100 unique ids, what
 *       the mirror found, a failed batch left out (never a rejection), and the time limit passed
 *       down as an abort signal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { describe, expect, it, vi } from "vitest";
import { lookupPageMeta } from "@/lib/pack-stats";

const meta = (id: number) => ({ beatmapId: id }) as BeatmapMeta;

describe("lookupPageMeta", () => {
  it("asks the mirror for each unique id once, 100 a call, and returns what it found", async () => {
    const getBeatmaps = vi.fn(
      async (ids: readonly number[], _options?: { signal?: AbortSignal }) => ({
        found: new Map(ids.filter((id) => id !== 7).map((id) => [id, meta(id)])),
        missing: ids.filter((id) => id === 7),
      }),
    );
    const ids = [...Array.from({ length: 150 }, (_, i) => i + 1), 1, 2];
    const found = await lookupPageMeta(ids, { mirror: { getBeatmaps } });
    expect(getBeatmaps).toHaveBeenCalledTimes(2);
    expect(getBeatmaps.mock.calls.map(([batch]) => batch.length)).toEqual([100, 50]);
    expect(getBeatmaps.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(found).toHaveLength(149);
  });

  it("leaves out a batch the mirror failed, without rejecting", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const getBeatmaps = vi.fn(async () => Promise.reject(new Error("timeout")));
    await expect(lookupPageMeta([1, 2], { mirror: { getBeatmaps } })).resolves.toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("asks nothing for a pack with no maps", async () => {
    const getBeatmaps = vi.fn();
    await expect(lookupPageMeta([], { mirror: { getBeatmaps } })).resolves.toEqual([]);
    expect(getBeatmaps).not.toHaveBeenCalled();
  });
});
