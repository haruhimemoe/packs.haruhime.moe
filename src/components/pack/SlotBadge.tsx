/**
 * @file src/components/pack/SlotBadge.tsx
 * @desc A bucket's pill for BucketManager (NM, EZ, TB), rendering no map: @haruhimemoe/ui's
 *       ModBadge with the bucket's code, its full name as its title, and a custom bucket's
 *       palette color through ModBadge's color prop, all built by slotBadgeValue.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import { ModBadge } from "@haruhimemoe/ui";
import type { BucketEntry } from "@/schemas/pack";
import { slotBadgeValue } from "@/utils/slot-badge";

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
  const slot = slotBadgeValue(entry, index);
  return (
    <ModBadge mod={slot.mod ?? ""} color={slot.color} title={slot.title}>
      {slot.label}
    </ModBadge>
  );
}
