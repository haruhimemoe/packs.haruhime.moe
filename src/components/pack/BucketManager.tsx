/**
 * @file src/components/pack/BucketManager.tsx
 * @desc The "Slots" card body: the pack's buckets in pool order. Reorder by dragging or with the
 *       arrow buttons; custom slots can be recolored, renamed, deleted (only when empty), and set
 *       their mods; a form adds new ones. No-slot maps always come first and aren't listed here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import {
  BUCKET_CODE_MESSAGES,
  bucketName,
  checkBucketCode,
  isCustomBucket,
  NO_MODS,
  nextFreeColor,
  type SlotMods,
} from "@haruhimemoe/pool";
import { type FormEvent, useId, useState } from "react";
import { ColorPicker } from "@/components/pack/ColorPicker";
import { ModBadge } from "@/components/pack/ModBadge";
import { ModsField } from "@/components/pack/ModsField";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/fieldStyles";
import type { BucketEntry, PoolSlot } from "@/schemas/pack";

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

const maps = (n: number) => `${n} ${n === 1 ? "map" : "maps"}`;

function RenameForm({
  code,
  buckets,
  onRename,
  onDone,
}: {
  code: string;
  buckets: readonly BucketEntry[];
  onRename: (code: string, next: string) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(code);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = value.trim();
    if (next !== code) {
      const problem = checkBucketCode(buckets, next, { renaming: code });
      if (problem) {
        setError(BUCKET_CODE_MESSAGES[problem]);
        return;
      }
      onRename(code, next);
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        New code for {code}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        className={fieldClasses("w-32")}
      />
      <Button type="submit" variant="secondary">
        Save
      </Button>
      <Button variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      {error ? (
        <p role="alert" className="w-full text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}

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
  const [dragging, setDragging] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pickedColor, setPickedColor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codeId = useId();
  const color = pickedColor ?? nextFreeColor(buckets);

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = code.trim();
    const problem = checkBucketCode(buckets, next);
    if (problem) {
      setError(BUCKET_CODE_MESSAGES[problem]);
      return;
    }
    onAdd(next, color);
    setCode("");
    setPickedColor(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-c3 text-sm">
        Maps without a slot always come first. Drag slots or use the arrows to change the order.
      </p>
      <ul className="flex flex-col gap-2">
        {buckets.map((entry, i) => {
          const count = slots.filter((s) => s.mod === entry.code).length;
          const name = bucketName(entry);
          return (
            <li
              key={entry.code}
              aria-label={`${name} slot, ${maps(count)}`}
              // An input inside a draggable row can't be text-selected in Firefox.
              draggable={!disabled && renaming !== entry.code}
              onDragStart={(event) => {
                setDragging(entry.code);
                event.dataTransfer?.setData("text/plain", entry.code);
              }}
              onDragOver={(event) => {
                if (dragging !== null) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging !== null && dragging !== entry.code) onMove(dragging, i);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
              className="flex flex-wrap items-center gap-3 rounded-[10px] bg-b5 p-3"
            >
              <span aria-hidden="true" className="cursor-grab select-none text-c4">
                ⋮⋮
              </span>
              <ModBadge entry={entry} />
              {/* A custom slot's badge already shows its code. */}
              {isCustomBucket(entry) ? null : <span className="font-bold text-c1">{name}</span>}
              <span className="text-c4 text-sm">({count})</span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  aria-label={`Move ${entry.code} up`}
                  disabled={disabled || i === 0}
                  onClick={() => onMove(entry.code, i - 1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move ${entry.code} down`}
                  disabled={disabled || i === buckets.length - 1}
                  onClick={() => onMove(entry.code, i + 1)}
                >
                  ↓
                </Button>
              </div>
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
                    <RenameForm
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
            </li>
          );
        })}
      </ul>

      <form onSubmit={add} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={codeId} className="font-bold text-c3 text-sm">
              New slot code
            </label>
            <input
              id={codeId}
              value={code}
              disabled={disabled}
              placeholder="EZ"
              onChange={(event) => {
                setCode(event.target.value);
                setError(null);
              }}
              className={fieldClasses("w-40")}
            />
          </div>
          <ColorPicker
            legend="Color for the new slot"
            value={color}
            disabled={disabled}
            onChange={setPickedColor}
          />
          <Button type="submit" variant="secondary" disabled={disabled}>
            Add slot
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-rose-300 text-sm">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
