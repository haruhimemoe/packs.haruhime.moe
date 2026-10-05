/**
 * @file src/components/account/ApiKeyReveal.tsx
 * @desc A new API key, shown once, on @haruhimemoe/ui's CopyField, and "I've saved it", which
 *       hides it for good.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { Button, CopyField } from "@haruhimemoe/ui";
import type { Ref } from "react";

type ApiKeyRevealProps = {
  /** The whole key, which the server never shows again. */
  apiKey: string;
  onSaved: () => void;
  /** The key field, which the card focuses when the key appears. */
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * @function ApiKeyReveal
 * @param props {ApiKeyRevealProps} the key, what "I've saved it" does, and the field's ref
 * @returns {JSX.Element} the warning, the key field, Copy and I've saved it
 */
export function ApiKeyReveal({ apiKey, onSaved, inputRef }: ApiKeyRevealProps) {
  return (
    <>
      <p className="font-bold text-c1 text-sm">Copy your key now. You won't see it again.</p>
      <CopyField
        ref={inputRef}
        label="Your new API key"
        value={apiKey}
        copiedMessage="Key copied."
        failedMessage="Couldn't copy. Select the key and copy it by hand."
      />
      <Button variant="ghost" onClick={onSaved}>
        I've saved it
      </Button>
    </>
  );
}
