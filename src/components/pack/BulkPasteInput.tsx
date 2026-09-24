/**
 * @file src/components/pack/BulkPasteInput.tsx
 * @desc Paste a whole mappool: "NM1 129891" / "EZ2 <link>" lines and bare IDs (no slot). Good lines
 *       are added (new codes become custom slots); bad lines stay in the box with a reason.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import {
  bucketsOf,
  insertBeforeTb,
  parsePoolText,
  planMerge,
  type SlotLineError,
  slotLabel,
} from "@haruhimemoe/pool";
import { Button, fieldClasses } from "@haruhimemoe/ui";
import { type FormEvent, useId, useState } from "react";
import { MAX_SLOTS } from "@/constants/pack";
import type { BucketEntry, CustomBucket, PoolSlot } from "@/schemas/pack";

type BulkPasteInputProps = {
  onAdd: (slots: PoolSlot[], newBuckets: CustomBucket[]) => void;
  /** Current pool, so the summary can say what was replaced or didn't fit. */
  existing?: readonly PoolSlot[];
  /** The pack's buckets, so pasted codes match them in any case. */
  buckets?: readonly BucketEntry[];
  disabled?: boolean;
};

const plural = (n: number) => `${n} ${n === 1 ? "map" : "maps"}`;
const asLine = (slot: PoolSlot) =>
  slot.mod === null ? String(slot.beatmapId) : `${slotLabel(slot)} ${slot.beatmapId}`;

const summarize = (
  { added, replaced, dropped }: ReturnType<typeof planMerge>,
  created: readonly CustomBucket[],
): string =>
  [
    added.length > 0 ? `Added ${plural(added.length)}.` : "",
    created.length > 0
      ? `Added ${created.length === 1 ? "slot" : "slots"} ${created.map((b) => b.code).join(", ")}.`
      : "",
    replaced.length > 0 ? `Replaced ${replaced.map(slotLabel).join(", ")}.` : "",
    dropped.length > 0 ? `${dropped.length} didn't fit: the pack is full (${MAX_SLOTS} maps).` : "",
  ]
    .filter(Boolean)
    .join(" ");

const PLACEHOLDER =
  "NM1 129891\nEZ1 https://osu.ppy.sh/beatmapsets/39804#osu/129891\n1872396, 2000001";

export function BulkPasteInput({
  onAdd,
  existing = [],
  buckets,
  disabled = false,
}: BulkPasteInputProps) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<SlotLineError[]>([]);
  const [summary, setSummary] = useState("");
  const id = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = parsePoolText(text, { slots: existing, buckets });
    // The bucket list once the pasted custom slots exist, as the draft reducer will build it.
    const withNew = result.newBuckets.reduce<BucketEntry[]>(
      (list, bucket) => insertBeforeTb(list, bucket),
      [...bucketsOf({ buckets })],
    );
    const plan = planMerge(existing, result.slots, withNew);
    const accepted = [...plan.added, ...plan.replaced];
    // Only create slots that actually received a map.
    const used = new Set(accepted.map((slot) => slot.mod));
    const created = result.newBuckets.filter((bucket) => used.has(bucket.code));
    if (accepted.length > 0) onAdd(accepted, created);
    setSummary(summarize(plan, created));
    setErrors(result.errors);
    // Keep everything that didn't make it into the pool so nothing the host pasted is lost.
    setText([...result.errors.map((e) => e.text), ...plan.dropped.map(asLine)].join("\n"));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={id} className="font-bold text-c3 text-sm">
        Paste a mappool
      </label>
      <textarea
        id={id}
        rows={5}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        placeholder={PLACEHOLDER}
        className={fieldClasses("font-mono")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={disabled || text.trim() === ""}>
          Add to pool
        </Button>
        <output className="text-c3 text-sm">{summary}</output>
      </div>
      {errors.length > 0 ? (
        <ul role="alert" className="flex flex-col gap-1 text-rose-300 text-sm">
          {errors.map((error) => (
            <li key={`${error.line}-${error.text}`}>
              Line {error.line}: {error.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
