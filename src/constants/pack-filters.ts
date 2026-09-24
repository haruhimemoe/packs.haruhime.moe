/**
 * @file src/constants/pack-filters.ts
 * @desc The /packs filter bar (filters spec): slider bounds, sort options, mode and source chip
 *       labels, how many filtered cards show at a time, how long a loaded index is kept, how often the place
 *       in the results is saved for Back, and the timings that keep screen readers and the
 *       browser's history calm while someone drags a slider or types.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { Ruleset } from "@haruhimemoe/pool";

/**
 * A range slider's bounds. A bottom end at `min` means no lower limit and a top end at `max`
 * means no upper limit ("10+"), so no pack sits outside what the slider can reach. `step` is as
 * fine as the values packs carry, because a value typed into a slider's box snaps to it; the
 * arrow keys move one step and Page Up/Down ten. `decimals` is how precisely a range is kept
 * (and written in the URL).
 */
export type FilterBounds = {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly decimals: number;
};

/** Star rating: 0 to 10+, step 0.01 (Page Up/Down 0.1), like the 2-decimal ratings on cards. */
export const STAR_RANGE: FilterBounds = Object.freeze({
  min: 0,
  max: 10,
  step: 0.01,
  decimals: 2,
});

/** Map length in seconds: 0:00 to 10:00+, step one second (Page Up/Down ten). */
export const LENGTH_RANGE: FilterBounds = Object.freeze({
  min: 0,
  max: 600,
  step: 1,
  decimals: 0,
});

/** BPM: 60 to 300+, step 1 (Page Up/Down 10). */
export const BPM_RANGE: FilterBounds = Object.freeze({ min: 60, max: 300, step: 1, decimals: 0 });

/** Maps in a pack: 1 to 40+. */
export const MAP_COUNT_RANGE: FilterBounds = Object.freeze({
  min: 1,
  max: 40,
  step: 1,
  decimals: 0,
});

/** Sort options, as written in `?sort=`. The first is the default and never written. */
export const PACK_SORTS = ["new", "updated", "sr-asc", "sr-desc", "maps", "name"] as const;

export type PackSort = (typeof PACK_SORTS)[number];

export const DEFAULT_PACK_SORT: PackSort = "new";

export const PACK_SORT_LABELS: Readonly<Record<PackSort, string>> = Object.freeze({
  new: "Newest",
  updated: "Recently updated",
  "sr-asc": "Star rating, low to high",
  "sr-desc": "Star rating, high to low",
  maps: "Most maps",
  name: "Name, A to Z",
});

/** Mode chips, in stats order, with the names players know them by. */
export const MODE_LABELS: Readonly<Record<Ruleset, string>> = Object.freeze({
  osu: "osu!",
  taiko: "taiko",
  fruits: "catch",
  mania: "mania",
});

/**
 * Where a public pack comes from: saved by someone (community), or a past tournament pool we
 * imported (archive, pool archive spec). Both are shown by default.
 */
export const PACK_SOURCES = ["community", "archive"] as const;

export type PackSource = (typeof PACK_SOURCES)[number];

export const PACK_SOURCE_LABELS: Readonly<Record<PackSource, string>> = Object.freeze({
  community: "Community",
  archive: "Archive",
});

/** `?source=` when every source chip is off. */
export const NO_SOURCE_PARAM = "none";

/** Filtered cards shown at first, and added by each "Show more". */
export const FILTER_RESULTS_STEP = 50;

/**
 * How long a loaded search index is kept for the tab, so coming back to /packs has it at once.
 * Past that, the next visit fetches it again (a pack saved meanwhile shows up).
 */
export const INDEX_REUSE_MS = 5 * 60_000;

/** Least time between two saves of the reader's place in the results while they scroll. */
export const LIST_VIEW_SAVE_MS = 200;

/** Quiet time after the last change before the result count is announced. */
export const COUNT_SETTLE_MS = 400;

/**
 * Least time between two URL writes. A slider drag changes the filters many times a second, and
 * Safari throws after 100 history writes in 10 seconds.
 */
export const URL_WRITE_INTERVAL_MS = 250;
