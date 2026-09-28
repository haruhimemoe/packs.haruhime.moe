/**
 * @file src/components/pack/BucketAddForm.tsx
 * @desc Adds a custom slot: its code, a color (the next free one until one is picked) and Add
 *       slot. A code @haruhimemoe/pool's checkBucketCode refuses shows why.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { BUCKET_CODE_MESSAGES, checkBucketCode, nextFreeColor } from "@haruhimemoe/pool";
import { Button, Notice, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useId, useState } from "react";
import { ColorPicker } from "@/components/pack/ColorPicker";
import type { BucketEntry } from "@/schemas/pack";

type BucketAddFormProps = {
  buckets: readonly BucketEntry[];
  disabled?: boolean;
  onAdd: (code: string, color: number) => void;
};

/**
 * @function BucketAddForm
 * @param props {BucketAddFormProps} the pack's buckets, whether editing is locked, and what adding
 *        does
 * @returns {JSX.Element} the add-slot form
 */
export function BucketAddForm({ buckets, disabled = false, onAdd }: BucketAddFormProps) {
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
    <form onSubmit={add} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <TextInput
          id={codeId}
          label="New slot code"
          value={code}
          disabled={disabled}
          placeholder="EZ"
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          className="w-40"
        />
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
        <Notice tone="error" live>
          {error}
        </Notice>
      ) : null}
    </form>
  );
}
