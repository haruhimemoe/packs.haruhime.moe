/**
 * @file src/components/beatmap/BeatmapStats.tsx
 * @desc Compact CS / AR / OD / HP / BPM / length row.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { formatBpm, formatDuration, formatStat } from "@/utils/format";

export function BeatmapStats({ meta }: { meta: BeatmapMeta }) {
  const stats = [
    ["CS", formatStat(meta.cs)],
    ["AR", formatStat(meta.ar)],
    ["OD", formatStat(meta.od)],
    ["HP", formatStat(meta.hp)],
    ["BPM", formatBpm(meta.bpm)],
    ["Length", formatDuration(meta.lengthSeconds)],
  ] as const;
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {stats.map(([label, value]) => (
        <div key={label} className="flex gap-1">
          <dt className="text-c4">{label}</dt>
          <dd className="font-bold text-c1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
