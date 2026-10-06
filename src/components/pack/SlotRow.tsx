/**
 * @file src/components/pack/SlotRow.tsx
 * @desc One pool slot as a kit MapCard row: slot pill, cover, title linked to osu! in a new tab,
 *       stars with mods and stats, the freemod line, Copy ID, and optional drag handle, move
 *       buttons, Move (to another bucket) and Remove. The handle and move buttons only render
 *       when `sortable` is given (read-only surfaces never pass it, so they keep rendering plain
 *       rows with no drag affordance).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { type SlotMods, slotTitle } from "@haruhimemoe/pool";
import {
  Button,
  MapCard,
  Select,
  type Sortable,
  SortableHandle,
  SortableMoveButtons,
  Text,
} from "@haruhimemoe/ui";
import { Fragment, useId, useState } from "react";
import { NO_SLOT_VALUE } from "@/constants/mods";
import type { MetaState } from "@/schemas/beatmap-meta";
import type { BucketEntry, PoolSlot, SlotBucket } from "@/schemas/pack";
import { slotBadgeValue } from "@/utils/slot-badge";
import { bucketListId, slotItemId } from "@/utils/slot-sortable-ids";
import { type ModdedRating, slotStars } from "@/utils/slot-stars";

/** A bucket a map can move to: its value, label and whether it is full. */
export type MoveTarget = { value: SlotBucket; label: string; disabled: boolean };

type SlotRowProps = {
  slot: PoolSlot;
  entry: BucketEntry | null;
  state: MetaState;
  onRemove?: () => void;
  moveTargets?: readonly MoveTarget[];
  onMove?: (to: SlotBucket) => void;
  /** What this slot plays with. Absent: shown without mods. */
  slotMods?: SlotMods;
  /** Ratings with mods: absent while calculating, empty when they couldn't be calculated. */
  ratings?: readonly ModdedRating[];
  /** Dragging this slot by its handle (mouse, touch or keyboard). Absent: no handle, no move
   * buttons, matching how onRemove/onMove already render nothing when omitted. */
  sortable?: Sortable;
  /** This slot's place within its bucket's list (empty slots not counted). Ignored without
   * `sortable`. */
  position?: number;
};

const freemodLine = (entries: readonly string[]) => (
  <Text size="xs" tone="subtle">
    <span className="sr-only">With mods:</span>{" "}
    <span>
      {entries.map((entry, i) => (
        <Fragment key={entry}>
          {i > 0 ? " · " : null}
          <span className="whitespace-nowrap">{entry}</span>
        </Fragment>
      ))}
    </span>
  </Text>
);

/**
 * @function SlotRow
 * @param props {SlotRowProps} slot, entry, state, onRemove, moveTargets, onMove, slotMods, ratings
 * @returns {JSX.Element} one pool slot as a MapCard row
 */
export function SlotRow({
  slot,
  entry,
  state,
  onRemove,
  moveTargets,
  onMove,
  slotMods,
  ratings,
  sortable,
  position,
}: SlotRowProps) {
  const title = slotTitle(slot);
  const itemId = slotItemId(slot.beatmapId);
  // Pick, then press Move: a <select> fires change on arrow keys, so moving on change would
  // move the map to whatever a keyboard user arrows past.
  const [picked, setPicked] = useState("");
  // A bucket renamed or deleted since it was picked is no longer a target: forget it.
  const offered = moveTargets?.some(
    (option) => !option.disabled && (option.value ?? NO_SLOT_VALUE) === picked,
  );
  const target = offered ? picked : "";
  const moveId = useId();
  const meta = state.status === "found" ? state.meta : null;
  const stars = meta ? slotStars(meta.starRating, slotMods, ratings) : null;
  const move =
    onMove && moveTargets ? (
      <div className="flex items-center gap-1">
        <Select
          id={moveId}
          label={`Move ${title} to`}
          hideLabel
          value={target}
          onChange={(event) => setPicked(event.target.value)}
          className="w-auto text-sm"
        >
          <option value="" disabled>
            Move to…
          </option>
          {moveTargets.map((option) => (
            <option
              key={option.value ?? NO_SLOT_VALUE}
              value={option.value ?? NO_SLOT_VALUE}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          aria-label={`Move ${title}`}
          disabled={target === ""}
          onClick={() => {
            onMove(target === NO_SLOT_VALUE ? null : target);
            setPicked("");
          }}
        >
          Move
        </Button>
      </div>
    ) : null;
  return (
    <MapCard
      as="li"
      {...(sortable
        ? sortable.item(itemId, {
            container: bucketListId(slot.mod),
            index: position ?? 0,
            label: title,
          })
        : {})}
      beatmapId={slot.beatmapId}
      map={meta}
      state={state.status === "found" ? "ready" : state.status}
      message={state.status === "error" ? state.message : undefined}
      slot={slotBadgeValue(entry, slot.index)}
      leading={sortable ? <SortableHandle sortable={sortable} id={itemId} /> : undefined}
      stars={stars?.stars}
      starsLabel={stars?.label}
      starsTitle={stars?.title}
      details={stars?.freemod ? freemodLine(stars.freemod) : undefined}
      actions={
        sortable || move || onRemove ? (
          <>
            {sortable ? (
              <SortableMoveButtons
                sortable={sortable}
                id={itemId}
                label={title}
                variant="secondary"
                orientation="vertical"
              />
            ) : null}
            {move}
            {onRemove ? (
              <Button variant="ghost" onClick={onRemove} aria-label={`Remove ${title}`}>
                Remove
              </Button>
            ) : null}
          </>
        ) : undefined
      }
      labels={{ missing: (id) => `Beatmap ${id} wasn't found on the mirror. Check the ID.` }}
      copyId
      newTab
    />
  );
}
