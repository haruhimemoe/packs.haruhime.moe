/**
 * @file tests/components/pack/PackEditor.test.tsx
 * @desc The editor's map usage: each map shows the other archive pools that used it, asked at
 *       once for the pool it opens with, again only for maps added later once the pool holds
 *       still, and without the saved pack's own entries.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackEditor } from "@/components/pack/PackEditor";
import type { BeatmapMetaApi } from "@/hooks/useBeatmapMeta";
import type { MapUsageFetcher } from "@/hooks/useMapUsage";
import type { MapUsageEntry } from "@/schemas/map-usage";
import type { Pool } from "@/schemas/pack";

const details = (beatmapId: number): BeatmapMeta => ({
  beatmapId,
  beatmapsetId: beatmapId,
  mode: "osu",
  title: `Song ${beatmapId}`,
  artist: "Artist",
  version: "Insane",
  creator: "Mapper",
  creatorId: 1,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5.5,
  checksum: null,
});

/** Every map's details shown (usage only shows with them); NM slots need no ratings with mods. */
const META: BeatmapMetaApi = {
  get: (beatmapId) => ({ status: "found", meta: details(beatmapId) }),
  retry: () => undefined,
  hasErrors: false,
};

const entry = (slug: string): MapUsageEntry => ({
  slug,
  tournament: "Spring Cup",
  round: "Finals",
  year: 2024,
  badged: null,
  slot: "NM1",
  mods: "NM",
  fingerprint: slug.slice(0, 1).repeat(64),
});

/** Map 75 was used by the pack being edited and one other; map 76 by two others. */
const fetcher = () =>
  vi.fn<MapUsageFetcher>(async (ids) => ({
    beatmaps: ids.map((beatmapId) => {
      const entries =
        beatmapId === 75
          ? [entry("aaaaaaaaaa"), entry("bbbbbbbbbb")]
          : beatmapId === 76
            ? [entry("cccccccccc"), entry("dddddddddd")]
            : [];
      return { beatmapId, count: entries.length, entries };
    }),
  }));

const pool = (...ids: number[]): Pool => ({
  name: "Spring Cup Finals",
  slots: ids.map((beatmapId, i) => ({ mod: "NM", index: i + 1, beatmapId })),
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PackEditor map usage", () => {
  it("shows the other pools each map was used in, leaving out the pack being edited", async () => {
    const fetchUsage = fetcher();
    render(
      <PackEditor
        pack={pool(75, 76, 77)}
        dispatch={vi.fn()}
        ready
        meta={META}
        slug="aaaaaaaaaa"
        fetchUsage={fetchUsage}
        usageDelayMs={0}
      />,
    );
    expect(await screen.findByRole("button", { name: "Used in 2 pools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Used in 1 pool" })).toBeInTheDocument();
    expect(fetchUsage.mock.calls).toEqual([[[75, 76, 77]]]);
  });

  it("asks at once for the pool it opens with, then waits for changes to hold still", async () => {
    vi.useFakeTimers();
    const fetchUsage = fetcher();
    const view = (pack: Pool) => (
      <PackEditor pack={pack} dispatch={vi.fn()} ready meta={META} fetchUsage={fetchUsage} />
    );
    const { rerender } = render(view(pool(75)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchUsage.mock.calls).toEqual([[[75]]]);
    rerender(view(pool(75, 76)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchUsage).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchUsage.mock.calls).toEqual([[[75]], [[76]]]);
    expect(screen.getAllByRole("button", { name: "Used in 2 pools" })).toHaveLength(2);
  });
});
