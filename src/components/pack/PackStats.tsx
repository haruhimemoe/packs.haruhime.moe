/**
 * @file src/components/pack/PackStats.tsx
 * @desc Stats tiles above a pool: maps, length, averages, ranges. Computed from loaded metadata.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import {
  formatBpm,
  formatDuration,
  formatLongDuration,
  formatStars,
} from "@haruhimemoe/osu/format";
import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { StatList } from "@haruhimemoe/ui";
import type { MetaState } from "@/schemas/beatmap-meta";
import { packStats } from "@/utils/pack-stats";

type PackStatsProps<S extends { beatmapId: number }> = {
  slots: readonly S[];
  getState: (beatmapId: number) => MetaState;
  /** The stars a slot counts with (forced slots with their mods). Default: the plain rating. */
  starsOf?: (slot: S, meta: BeatmapMeta) => number;
  /** How fast a slot plays (a forced DT is 1.5), for its length and BPM. Default: 1. */
  speedOf?: (slot: S) => number;
};

const range = (low: string, high: string): string => (low === high ? low : `${low}–${high}`);

/**
 * @function PackStats
 * @param props {PackStatsProps<S>} slots, getState, starsOf, speedOf
 * @returns {JSX.Element | null} stats tiles above a pool
 */
export function PackStats<S extends { beatmapId: number }>({
  slots,
  getState,
  starsOf,
  speedOf,
}: PackStatsProps<S>) {
  const stats = packStats(slots, getState, starsOf, speedOf);
  if (stats.status === "empty") return null;

  const tiles: [string, string][] = [["Maps", String(stats.maps)]];
  if (stats.status === "loading") {
    for (const label of ["Length", "Avg length", "Avg ★", "★ range", "BPM"])
      tiles.push([label, "…"]);
  } else if (stats.summary) {
    const s = stats.summary;
    tiles.push(
      ["Length", formatLongDuration(s.totalLength)],
      ["Avg length", formatDuration(s.averageLength)],
      ["Avg ★", formatStars(s.averageStars)],
      ["★ range", range(formatStars(s.minStars), formatStars(s.maxStars))],
      ["BPM", range(formatBpm(s.minBpm), formatBpm(s.maxBpm))],
    );
  }
  const skipped = stats.status === "ready" ? stats.skipped : 0;

  return (
    <section aria-label="Pack stats" className="flex flex-col gap-2">
      <StatList variant="tiles" items={tiles.map(([label, value]) => ({ label, value }))} />
      {skipped > 0 ? (
        <p className="text-c4 text-sm">
          Stats leave out {skipped} {skipped === 1 ? "map that" : "maps that"} didn't load.
        </p>
      ) : null}
    </section>
  );
}
