/**
 * @file tests/components/pack/PackStats.test.tsx
 * @desc Stats tiles: loading dots, values, equal ranges, skipped-map note, empty pool.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PackStats } from "@/components/pack/PackStats";
import type { MetaState } from "@/hooks/beatmapMetaState";

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
const getter =
  (entries: Record<number, MetaState>) =>
  (id: number): MetaState =>
    entries[id] ?? { status: "loading" };
const value = (label: string) =>
  screen.getByText(label).parentElement?.querySelector("dd")?.textContent;

describe("PackStats", () => {
  it("renders nothing for an empty pool", () => {
    const { container } = render(<PackStats slots={[]} getState={getter({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the map count and dots while loading", () => {
    render(<PackStats slots={[{ beatmapId: 1 }, { beatmapId: 2 }]} getState={getter({})} />);
    expect(screen.getByRole("region", { name: "Pack stats" })).toBeInTheDocument();
    expect(value("Maps")).toBe("2");
    expect(value("Avg ★")).toBe("…");
  });

  it("shows totals, averages, and ranges", () => {
    render(
      <PackStats
        slots={[{ beatmapId: 1 }, { beatmapId: 2 }]}
        getState={getter({
          1: { status: "found", meta: meta(1, 4.5, 150, 1800) },
          2: { status: "found", meta: meta(2, 6.25, 200, 1850) },
        })}
      />,
    );
    expect(value("Length")).toBe("1:00:50");
    expect(value("Avg length")).toBe("30:25");
    expect(value("Avg ★")).toBe("5.38");
    expect(value("★ range")).toBe("4.50–6.25");
    expect(value("BPM")).toBe("150–200");
  });

  it("shows one value when a range is flat, and notes skipped maps", () => {
    render(
      <PackStats
        slots={[{ beatmapId: 1 }, { beatmapId: 2 }, { beatmapId: 3 }]}
        getState={getter({
          1: { status: "found", meta: meta(1, 5, 180, 100) },
          2: { status: "missing" },
          3: { status: "found", meta: meta(3, 5, 180.2, 100) },
        })}
      />,
    );
    expect(value("★ range")).toBe("5.00");
    expect(value("BPM")).toBe("180");
    expect(screen.getByText("Stats leave out 1 map that didn't load.")).toBeInTheDocument();
  });

  it("shows only the count and the note when nothing loaded", () => {
    render(
      <PackStats
        slots={[{ beatmapId: 1 }, { beatmapId: 2 }]}
        getState={getter({ 1: { status: "missing" }, 2: { status: "missing" } })}
      />,
    );
    expect(value("Maps")).toBe("2");
    expect(screen.queryByText("Avg ★")).not.toBeInTheDocument();
    expect(screen.getByText("Stats leave out 2 maps that didn't load.")).toBeInTheDocument();
  });
  it("counts each slot with starsOf", () => {
    render(
      <PackStats
        slots={[{ beatmapId: 1 }, { beatmapId: 2 }]}
        getState={getter({
          1: { status: "found", meta: meta(1, 5, 180, 100) },
          2: { status: "found", meta: meta(2, 3, 180, 100) },
        })}
        starsOf={(slot) => (slot.beatmapId === 1 ? 7 : 3)}
      />,
    );
    expect(value("Avg ★")).toBe("5.00");
    expect(value("★ range")).toBe("3.00–7.00");
  });
});
