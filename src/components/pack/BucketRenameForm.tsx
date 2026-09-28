/**
 * @file src/components/pack/BucketRenameForm.tsx
 * @desc Inline rename for a custom slot: a code field (labelled for screen readers only), Save and
 *       Cancel. A code @haruhimemoe/pool's checkBucketCode refuses shows why and stays open.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { BUCKET_CODE_MESSAGES, checkBucketCode } from "@haruhimemoe/pool";
import { Button, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useId, useState } from "react";
import type { BucketEntry } from "@/schemas/pack";

type BucketRenameFormProps = {
  /** The slot's current code. */
  code: string;
  /** Every bucket, to refuse a code that clashes with another. */
  buckets: readonly BucketEntry[];
  onRename: (code: string, next: string) => void;
  /** Closes the form, after a save or a cancel. */
  onDone: () => void;
};

/**
 * @function BucketRenameForm
 * @param props {BucketRenameFormProps} the slot, the pack's buckets, and what Save and Cancel do
 * @returns {JSX.Element} the rename form
 */
export function BucketRenameForm({ code, buckets, onRename, onDone }: BucketRenameFormProps) {
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
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
      <TextInput
        id={id}
        label={<span className="sr-only">New code for {code}</span>}
        wrapperClassName="gap-0"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        error={error}
        className="w-32"
      />
      <Button type="submit" variant="secondary">
        Save
      </Button>
      <Button variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}
