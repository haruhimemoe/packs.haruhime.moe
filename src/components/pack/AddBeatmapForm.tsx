/**
 * @file src/components/pack/AddBeatmapForm.tsx
 * @desc Add one map: pick a bucket (or no slot), paste an ID or osu! difficulty link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import {
  BEATMAP_REF_MESSAGES,
  bucketOptionLabel,
  DEFAULT_BUCKETS,
  NO_SLOT_NAME,
  parseBeatmapRef,
} from "@haruhimemoe/pool";
import { Button, Select, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useId, useState } from "react";
import { NO_SLOT_VALUE } from "@/constants/mods";
import type { BucketEntry, SlotBucket } from "@/schemas/pack";

type AddBeatmapFormProps = {
  onAdd: (mod: SlotBucket, beatmapId: number) => void;
  /** The pack's buckets in pool order (default: the six built-ins). */
  buckets?: readonly BucketEntry[];
  disabled?: boolean;
};

export function AddBeatmapForm({
  onAdd,
  buckets = DEFAULT_BUCKETS,
  disabled = false,
}: AddBeatmapFormProps) {
  const [choice, setChoice] = useState<string>("NM");
  // A deleted or renamed bucket can't stay selected: fall back to NM.
  const current =
    choice === NO_SLOT_VALUE || buckets.some((entry) => entry.code === choice) ? choice : "NM";
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectId = useId();
  const inputId = useId();
  const errorId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ref = parseBeatmapRef(value);
    if (!ref.ok) {
      setError(BEATMAP_REF_MESSAGES[ref.reason]);
      return;
    }
    onAdd(current === NO_SLOT_VALUE ? null : current, ref.beatmapId);
    setValue("");
    setError(null);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Select
          id={selectId}
          label="Slot"
          value={current}
          disabled={disabled}
          onChange={(event) => setChoice(event.target.value)}
          className="w-auto"
        >
          <option value={NO_SLOT_VALUE}>{NO_SLOT_NAME}</option>
          {buckets.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {bucketOptionLabel(entry)}
            </option>
          ))}
        </Select>
        {/* The error sits under the whole row, not the field, so it's wired up by hand. */}
        <TextInput
          id={inputId}
          label="Beatmap ID or link"
          wrapperClassName="min-w-48 flex-1"
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder="129891 or https://osu.ppy.sh/beatmapsets/…#osu/…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <Button type="submit" disabled={disabled}>
          Add
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
