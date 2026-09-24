/**
 * @file src/components/pack/PackStats.tsx
 * @desc Stats tiles above a pool: maps, length, averages, ranges. Computed from loaded metadata.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import type { MetaState } from "@/hooks/beatmapMetaState";
import { formatBpm, formatDuration, formatLongDuration, formatStars } from "@/utils/format";
import { packStats } from "@/utils/pack-stats";

type PackStatsProps<S extends { beatmapId: number }> = {
  slots: readonly S[];
  getState: (beatmapId: number) => MetaState;
  /** The stars a slot counts with (forced slots with their mods). Default: the plain rating. */
  starsOf?: (slot: S, meta: BeatmapMeta) => number;
};

const range = (low: string, high: string): string => (low === high ? low : `${low}–${high}`);

export function PackStats<S extends { beatmapId: number }>({
  slots,
  getState,
  starsOf,
}: PackStatsProps<S>) {
  const stats = packStats(slots, getState, starsOf);
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
      <dl className="flex flex-wrap gap-2">
        {tiles.map(([label, value]) => (
          <div key={label} className="min-w-24 rounded-[10px] bg-b4 px-3 py-2">
            <dt className="text-c4 text-xs">{label}</dt>
            <dd className="font-bold text-c1">{value}</dd>
          </div>
        ))}
      </dl>
      {skipped > 0 ? (
        <p className="text-c4 text-sm">
          Stats leave out {skipped} {skipped === 1 ? "map that" : "maps that"} didn't load.
        </p>
      ) : null}
    </section>
  );
}
