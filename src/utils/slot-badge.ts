/**
 * @file src/utils/slot-badge.ts
 * @desc A slot's pill as MapCard's `slot` value: its label ("NM1", or the bucket's code), the
 *       bucket's full name as its title, the mod that picks a built-in bucket's color, and a
 *       custom bucket's palette color by name. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { bucketName, isCustomBucket, slotLabel } from "@haruhimemoe/pool";
import type { MapCardProps } from "@haruhimemoe/ui";
import { paletteColor } from "@/constants/palette";
import type { BucketEntry } from "@/schemas/pack";

/** MapCard's slot value. */
export type SlotBadgeValue = NonNullable<MapCardProps["slot"]>;

/**
 * @function slotBadgeValue
 * @param entry {BucketEntry | null} the slot's bucket, or null for a map in no slot
 * @param index {number | undefined} the slot number; absent for just the bucket's code
 * @returns {SlotBadgeValue} the label, mod, title and (custom buckets) color
 */
export const slotBadgeValue = (entry: BucketEntry | null, index?: number): SlotBadgeValue => ({
  label:
    index === undefined ? (entry?.code ?? "–") : slotLabel({ mod: entry?.code ?? null, index }),
  mod: entry?.code ?? "",
  title: bucketName(entry),
  color: entry !== null && isCustomBucket(entry) ? paletteColor(entry.color) : undefined,
});
