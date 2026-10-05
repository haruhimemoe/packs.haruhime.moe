/**
 * @file src/components/pack/BucketManager.tsx
 * @desc The "Slots" card body: the pack's buckets in pool order. Reorder by dragging a slot's
 *       handle (mouse, touch or keyboard, ui's SortableList) or with Up and Down; custom slots can
 *       be recolored, renamed, deleted (only when empty), and set their mods (BucketRenameForm,
 *       ModsField); BucketAddForm adds new ones. No-slot maps always come first and aren't listed
 *       here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { bucketName, isCustomBucket, NO_MODS, type SlotMods } from "@haruhimemoe/pool";
import { Button, SortableList, Text } from "@haruhimemoe/ui";
import { useState } from "react";
import { BucketAddForm } from "@/components/pack/BucketAddForm";
import { BucketRenameForm } from "@/components/pack/BucketRenameForm";
import { ColorPicker } from "@/components/pack/ColorPicker";
import { ModsField } from "@/components/pack/ModsField";
import { SlotBadge } from "@/components/pack/SlotBadge";
import type { BucketEntry, PoolSlot } from "@/schemas/pack";
import { countOf } from "@/utils/text";

type BucketManagerProps = {
  buckets: readonly BucketEntry[];
  slots: readonly PoolSlot[];
  disabled?: boolean;
  onAdd: (code: string, color: number) => void;
  onRename: (code: string, next: string) => void;
  onRecolor: (code: string, color: number) => void;
  onMove: (code: string, to: number) => void;
  onRemove: (code: string) => void;
  onSetMods: (code: string, mods: SlotMods) => void;
};

/**
 * @function BucketManager
 * @param props {BucketManagerProps} the pack's buckets and slots, whether editing is locked, and
 *        one handler per bucket edit
 * @returns {JSX.Element} the bucket list and the add-slot form
 */
export function BucketManager({
  buckets,
  slots,
  disabled = false,
  onAdd,
  onRename,
  onRecolor,
  onMove,
  onRemove,
  onSetMods,
}: BucketManagerProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const countFor = (code: string) => slots.filter((s) => s.mod === code).length;

  return (
    <div className="flex flex-col gap-4">
      <Text tone="muted">
        Maps without a slot always come first. Drag a slot by its handle, or use Up and Down, to
        change the order.
      </Text>
      <SortableList
        as="ul"
        items={buckets}
        getId={(entry) => entry.code}
        getLabel={(entry) => entry.code}
        label="Slots"
        disabled={disabled}
        onMove={({ id, to }) => onMove(id, to.index)}
        className="gap-2 [--sortable-gap:0.5rem]"
        itemClassName="flex flex-wrap items-center gap-2 rounded-[10px] bg-b5 p-3 sm:gap-3"
        itemProps={(entry) => ({
          "aria-label": `${bucketName(entry)} slot, ${countOf(countFor(entry.code), "map")}`,
        })}
      >
        {(entry, { handle, moveButtons }) => {
          const count = countFor(entry.code);
          const name = bucketName(entry);
          return (
            <>
              {handle}
              <SlotBadge entry={entry} />
              {/* A custom slot's badge already shows its code. */}
              {isCustomBucket(entry) ? null : <span className="font-bold text-c1">{name}</span>}
              <span className="text-c4 text-sm">({count})</span>
              <div className="ml-auto">{moveButtons}</div>
              {isCustomBucket(entry) ? (
                <div className="flex w-full flex-wrap items-center gap-3">
                  <ColorPicker
                    legend={`Color for ${entry.code}`}
                    offsetClass="ring-offset-b5"
                    value={entry.color}
                    disabled={disabled}
                    onChange={(next) => onRecolor(entry.code, next)}
                  />
                  {renaming === entry.code ? (
                    <BucketRenameForm
                      code={entry.code}
                      buckets={buckets}
                      onRename={onRename}
                      onDone={() => setRenaming(null)}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      aria-label={`Rename ${entry.code}`}
                      disabled={disabled}
                      onClick={() => setRenaming(entry.code)}
                    >
                      Rename
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${entry.code}`}
                    disabled={disabled || count > 0}
                    title={count > 0 ? "Remove or move its maps first." : undefined}
                    onClick={() => onRemove(entry.code)}
                  >
                    Delete
                  </Button>
                  {count > 0 ? (
                    <span className="text-c4 text-xs">Remove or move its maps first.</span>
                  ) : null}
                  <div className="w-full">
                    <ModsField
                      code={entry.code}
                      value={entry.mods ?? NO_MODS}
                      disabled={disabled}
                      onChange={(mods) => onSetMods(entry.code, mods)}
                    />
                  </div>
                </div>
              ) : null}
            </>
          );
        }}
      </SortableList>

      <BucketAddForm buckets={buckets} disabled={disabled} onAdd={onAdd} />
    </div>
  );
}
