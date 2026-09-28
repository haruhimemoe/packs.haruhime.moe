/**
 * @file src/components/pack/KeyPasteForm.tsx
 * @desc Paste a pack key (or a link/sentence containing one) and open it at /k#<key>.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import {
  decodePackKey,
  extractPackKey,
  PACK_KEY_ERROR_MESSAGES,
  PackKeyError,
} from "@haruhimemoe/pool";
import { Button, TextInput } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

/**
 * @function KeyPasteForm
 * @returns {JSX.Element} a field for a pack key or a link holding one, which opens it on /k
 */
export function KeyPasteForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = extractPackKey(value) ?? value.trim();
    try {
      decodePackKey(key);
    } catch (caught) {
      setError(caught instanceof PackKeyError ? caught.message : PACK_KEY_ERROR_MESSAGES.malformed);
      return;
    }
    setError(null);
    // Next's router doesn't fire hashchange for a hash-only change on the same path.
    if (window.location.pathname === "/k") window.location.hash = key;
    else router.push(`/k#${key}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
      <TextInput
        id={inputId}
        label="Pack key or link"
        wrapperClassName="min-w-48 flex-1"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="pk1.…"
        error={error}
        className="font-mono"
      />
      {/* mt-6 lines the button up with the field under its label. */}
      <Button type="submit" className="mt-6">
        Open
      </Button>
    </form>
  );
}
