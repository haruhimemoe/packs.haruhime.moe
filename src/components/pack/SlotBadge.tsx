/**
 * @file src/components/pack/SlotBadge.tsx
 * @desc A slot's or bucket's pill (NM1, EZ2, TB): @haruhimemoe/ui's ModBadge with the slot label,
 *       the bucket's full name as its title, and a custom bucket's palette color. No-slot maps
 *       get ModBadge's grey pill with just their number.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { bucketName, isCustomBucket, slotLabel } from "@haruhimemoe/pool";
import { ModBadge } from "@haruhimemoe/ui";
import { PALETTE_STYLES } from "@/constants/palette";
import type { BucketEntry } from "@/schemas/pack";

type SlotBadgeProps = {
  /** The slot's bucket, or null for a map in no slot. */
  entry: BucketEntry | null;
  /** The slot number; absent to show just the bucket's code. */
  index?: number;
};

/**
 * @function SlotBadge
 * @param props {SlotBadgeProps} the bucket and, for a slot, its number
 * @returns {JSX.Element} the pill: a built-in bucket in its osu! color, a custom one in its
 *          palette color, no slot in grey
 */
export function SlotBadge({ entry, index }: SlotBadgeProps) {
  const text =
    index === undefined ? (entry?.code ?? "–") : slotLabel({ mod: entry?.code ?? null, index });
  const custom =
    entry !== null && isCustomBucket(entry)
      ? `${PALETTE_STYLES[entry.color] ?? PALETTE_STYLES[0]} text-b6`
      : undefined;
  return (
    <ModBadge mod={entry?.code ?? ""} title={bucketName(entry)} className={custom}>
      {text}
    </ModBadge>
  );
}
