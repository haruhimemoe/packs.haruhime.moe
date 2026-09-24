/**
 * @file src/hooks/beatmapMetaState.ts
 * @desc Per-beatmap loading state shared by useBeatmapMeta and the pool components.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";

export type MetaState =
  | { status: "loading" }
  | { status: "found"; meta: BeatmapMeta }
  | { status: "missing" }
  | { status: "error"; message: string };
