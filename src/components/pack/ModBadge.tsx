/**
 * @file src/components/pack/ModBadge.tsx
 * @desc Coloured pill for a bucket or a slot label (NM1, EZ2, TB). No-slot maps get a grey pill
 *       with just their number.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { bucketName, isCustomBucket, slotLabel } from "@haruhimemoe/pool";
import { BUILT_IN_BADGE, NO_SLOT_BADGE, PALETTE_STYLES } from "@/constants/palette";
import type { BucketEntry } from "@/schemas/pack";
import { cn } from "@/utils/cn";

type ModBadgeProps = { entry: BucketEntry | null; index?: number };

const colorOf = (entry: BucketEntry | null): string => {
  if (entry === null) return NO_SLOT_BADGE;
  const background = isCustomBucket(entry)
    ? (PALETTE_STYLES[entry.color] ?? PALETTE_STYLES[0])
    : BUILT_IN_BADGE[entry.code];
  return `${background} text-b6`;
};

export function ModBadge({ entry, index }: ModBadgeProps) {
  const text =
    index === undefined ? (entry?.code ?? "–") : slotLabel({ mod: entry?.code ?? null, index });
  return (
    <span
      title={bucketName(entry)}
      className={cn(
        "inline-flex min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2 py-0.5 font-extrabold text-xs",
        colorOf(entry),
      )}
    >
      {text}
    </span>
  );
}
