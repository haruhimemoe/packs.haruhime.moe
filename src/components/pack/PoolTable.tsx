/**
 * @file src/components/pack/PoolTable.tsx
 * @desc Pool grouped by bucket: no-slot maps first, then the pack's buckets in order, one labelled
 *       section per non-empty group. Editable pools add Remove and "Move to" per row. Only the row
 *       whose ID was copied last says Copied.: one MapCopyScope around the groups.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import {
  bucketName,
  bucketOptionLabel,
  DEFAULT_BUCKETS,
  isCustomBucket,
  MAX_SLOT_INDEX,
  NO_SLOT_NAME,
  nextSlotIndex,
  type SlotMods,
  slotModsSummary,
  sortSlots,
} from "@haruhimemoe/pool";
import { EmptyState, MapCopyScope, MapGroup } from "@haruhimemoe/ui";
import { type MoveTarget, SlotRow } from "@/components/pack/SlotRow";
import { NO_SLOT_VALUE } from "@/constants/mods";
import type { ModdedStarRatings } from "@/hooks/useModdedStarRatings";
import type { MetaState } from "@/schemas/beatmap-meta";
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
};

/**
 * @function PoolTable
 * @param props {PoolTableProps} slots, buckets, getState, onRemove, onMove, modsBySlot, ratings
 * @returns {JSX.Element | null} pool grouped by bucket
 */
export function PoolTable({
  slots,
  buckets = DEFAULT_BUCKETS,
  getState,
  onRemove,
  onMove,
  modsBySlot,
  ratings,
}: PoolTableProps) {
  if (slots.length === 0) {
    return (
      <EmptyState variant="filled">
        No maps yet. Add a beatmap ID or paste a mappool above.
      </EmptyState>
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
    <MapCopyScope>
      <div className="flex flex-col gap-6">
        {groups.map(({ key, entry }) => {
          const code = entry?.code ?? null;
          const inGroup = ordered.filter((s) => s.mod === code);
          if (inGroup.length === 0) return null;
          return (
            <MapGroup
              key={key}
              title={bucketName(entry)}
              count={inGroup.length}
              detail={
                entry && isCustomBucket(entry) && entry.mods
                  ? slotModsSummary(entry.mods)
                  : undefined
              }
              list="ul"
              copyScope={false}
            >
              {inGroup.map((slot) => (
                <SlotRow
                  key={slotKey(slot)}
                  slot={slot}
                  entry={entry}
                  state={getState(slot.beatmapId)}
                  onRemove={onRemove ? () => onRemove(slot) : undefined}
                  moveTargets={onMove ? allTargets.filter((t) => t.value !== slot.mod) : undefined}
                  onMove={onMove ? (to) => onMove(slot, to) : undefined}
                  slotMods={modsBySlot?.get(slotKey(slot))}
                  ratings={ratings?.get(slotKey(slot))}
                />
              ))}
            </MapGroup>
          );
        })}
      </div>
    </MapCopyScope>
  );
}
