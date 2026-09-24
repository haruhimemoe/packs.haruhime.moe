/**
 * @file tests/unit/utils/pack-stats.test.ts
 * @desc packStats: empty, loading, all loaded, some missing/errored, none loaded, duplicates, and
 *       a custom starsOf for modded ratings.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { describe, expect, it } from "vitest";
import type { MetaState } from "@/hooks/beatmapMetaState";
import { packStats } from "@/utils/pack-stats";

const meta = (
  beatmapId: number,
  starRating: number,
  bpm: number,
  lengthSeconds: number,
): BeatmapMeta => ({
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
  bpm,
  lengthSeconds,
  starRating,
  checksum: null,
});

const states =
  (entries: Record<number, MetaState>) =>
  (id: number): MetaState =>
    entries[id] ?? { status: "loading" };

const found = (m: BeatmapMeta): MetaState => ({ status: "found", meta: m });
const slots = (...ids: number[]) => ids.map((beatmapId) => ({ beatmapId }));

describe("packStats", () => {
  it("is empty for an empty pool", () => {
    expect(packStats([], states({}))).toEqual({ status: "empty" });
  });

  it("waits while any map is loading", () => {
    expect(packStats(slots(1, 2), states({ 1: found(meta(1, 5, 180, 120)) }))).toEqual({
      status: "loading",
      maps: 2,
    });
  });

  it("summarizes every loaded map", () => {
    const result = packStats(
      slots(1, 2, 3),
      states({
        1: found(meta(1, 4.5, 150, 90)),
        2: found(meta(2, 6.25, 200, 150)),
        3: found(meta(3, 5.5, 175.6, 3600)),
      }),
    );
    expect(result).toEqual({
      status: "ready",
      maps: 3,
      skipped: 0,
      summary: {
        totalLength: 3840,
        averageLength: 1280,
        averageStars: (4.5 + 6.25 + 5.5) / 3,
        minStars: 4.5,
        maxStars: 6.25,
        minBpm: 150,
        maxBpm: 200,
      },
    });
  });

  it("leaves out missing and errored maps and counts them", () => {
    const result = packStats(
      slots(1, 2, 3),
      states({
        1: found(meta(1, 5, 180, 100)),
        2: { status: "missing" },
        3: { status: "error", message: "down" },
      }),
    );
    expect(result).toMatchObject({ status: "ready", maps: 3, skipped: 2 });
    expect(result.status === "ready" && result.summary?.totalLength).toBe(100);
  });

  it("has no summary when no map loaded", () => {
    expect(packStats(slots(1), states({ 1: { status: "missing" } }))).toEqual({
      status: "ready",
      maps: 1,
      skipped: 1,
      summary: null,
    });
  });

  it("counts a beatmap once per slot it's in", () => {
    const result = packStats(slots(1, 1), states({ 1: found(meta(1, 5, 180, 100)) }));
    expect(result).toMatchObject({ maps: 2, summary: { totalLength: 200 } });
  });
});

describe("packStats with modded ratings", () => {
  it("uses starsOf for averages and ranges", () => {
    const pool = [
      { mod: "HD", beatmapId: 1 },
      { mod: "NM", beatmapId: 2 },
    ];
    const result = packStats(
      pool,
      states({ 1: found(meta(1, 5, 180, 100)), 2: found(meta(2, 3, 180, 100)) }),
      (slot, m) => (slot.mod === "HD" ? 6 : m.starRating),
    );
    expect(result).toMatchObject({
      status: "ready",
      summary: { averageStars: 4.5, minStars: 3, maxStars: 6 },
    });
  });
});
