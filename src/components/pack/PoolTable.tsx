/**
 * @file src/components/pack/PoolTable.tsx
 * @desc Pool grouped by bucket: no-slot maps first, then the pack's buckets in order, one labelled
 *       section per non-empty group. Editable pools add Remove and "Move to" per row. Given map
 *       usage, each row shows the other archive pools that used its map.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import {
  bucketName,
  bucketOptionLabel,
  DEFAULT_BUCKETS,
  isCustomBucket,
  NO_SLOT_NAME,
  nextSlotIndex,
  type SlotMods,
  slotModsSummary,
  sortSlots,
} from "@haruhimemoe/pool";
import { type MoveTarget, SlotRow } from "@/components/pack/SlotRow";
import { NO_SLOT_VALUE } from "@/constants/mods";
import { MAX_SLOT_INDEX } from "@/constants/pack";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { ModdedStarRatings } from "@/hooks/useModdedStarRatings";
import type { MapUsageEntry } from "@/schemas/map-usage";
import { type BucketEntry, type PoolSlot, type SlotBucket, slotKey } from "@/schemas/pack";

type PoolTableProps = {
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[];
  getState: (beatmapId: number) => MetaState;
  onRemove?: (slot: PoolSlot) => void;
  onMove?: (slot: PoolSlot, to: SlotBucket) => void;
  /** slotKey -> mods, from usePoolStarRatings. */
  modsBySlot?: ReadonlyMap<string, SlotMods>;
  /** slotKey -> ratings with mods, from usePoolStarRatings. */
  ratings?: ModdedStarRatings;
  /** Beatmap id -> other archive pools that used it, from useMapUsage. */
  usageOf?: (beatmapId: number) => readonly MapUsageEntry[];
};

export function PoolTable({
  slots,
  buckets = DEFAULT_BUCKETS,
  getState,
  onRemove,
  onMove,
  modsBySlot,
  ratings,
  usageOf,
}: PoolTableProps) {
  if (slots.length === 0) {
    return (
      <p className="rounded-[10px] bg-b4 p-6 text-center text-c3">
        No maps yet. Add a beatmap ID or paste a mappool above.
      </p>
    );
  }
  const ordered = sortSlots(slots, buckets);
  const groups: { key: string; entry: BucketEntry | null }[] = [
    { key: NO_SLOT_VALUE, entry: null },
    ...buckets.map((entry) => ({ key: entry.code, entry })),
  ];
  const allTargets: MoveTarget[] = [
    { value: null, label: NO_SLOT_NAME, disabled: false },
    ...buckets.map((entry) => ({
      value: entry.code,
      label: bucketOptionLabel(entry),
      disabled: false,
    })),
  ].map((target) => ({
    ...target,
    disabled: nextSlotIndex(slots, target.value) > MAX_SLOT_INDEX,
  }));

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ key, entry }) => {
        const code = entry?.code ?? null;
        const inGroup = ordered.filter((s) => s.mod === code);
        if (inGroup.length === 0) return null;
        const name = bucketName(entry);
        return (
          <section key={key} aria-label={name}>
            <h3 className="mb-2 font-bold text-c1">
              {name} <span className="font-normal text-c4 text-sm">({inGroup.length})</span>
              {entry && isCustomBucket(entry) && entry.mods ? (
                <span className="font-normal text-c4 text-sm">
                  {" "}
                  · {slotModsSummary(entry.mods)}
                </span>
              ) : null}
            </h3>
            <ul className="flex flex-col gap-2">
              {inGroup.map((slot) => (
                <SlotRow
                  key={slotKey(slot)}
                  slot={slot}
                  entry={entry}
                  state={getState(slot.beatmapId)}
                  onRemove={onRemove ? () => onRemove(slot) : undefined}
                  moveTargets={
                    onMove ? allTargets.filter((target) => target.value !== slot.mod) : undefined
                  }
                  onMove={onMove ? (to) => onMove(slot, to) : undefined}
                  slotMods={modsBySlot?.get(slotKey(slot))}
                  ratings={ratings?.get(slotKey(slot))}
                  usage={usageOf?.(slot.beatmapId)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
