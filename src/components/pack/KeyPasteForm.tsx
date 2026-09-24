/**
 * @file src/components/pack/KeyPasteForm.tsx
 * @desc Paste a pack key (or a link/sentence containing one) and open it at /k#<key>.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import {
  decodePackKey,
  extractPackKey,
  PACK_KEY_ERROR_MESSAGES,
  PackKeyError,
} from "@haruhimemoe/pool";
import { Button, fieldClasses } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

export function KeyPasteForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

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
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="font-bold text-c3 text-sm">
        Pack key or link
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="pk1.…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={fieldClasses("min-w-48 flex-1 font-mono")}
        />
        <Button type="submit">Open</Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
