/**
 * @file src/schemas/beatmap-meta.ts
 * @desc Per-beatmap loading state (MetaState), shared by useBeatmapMeta, the pure pack helpers in
 *       src/utils and the pool components. A type only: it lives here so utils never import hooks.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";

/** A map's metadata: still loading, found, missing from the mirror and osu!, or failed. */
export type MetaState =
  | { status: "loading" }
  | { status: "found"; meta: BeatmapMeta }
  | { status: "missing" }
  | { status: "error"; message: string };
