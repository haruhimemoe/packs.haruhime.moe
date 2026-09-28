/**
 * @file src/components/account/ApiKeyReveal.tsx
 * @desc A new API key, shown once: read-only and selected on focus, a @haruhimemoe/ui CopyButton,
 *       and "I've saved it", which hides it for good.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button, CopyButton, TextInput } from "@haruhimemoe/ui";
import { type Ref, useId } from "react";

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
  const id = useId();
  return (
    <>
      <p className="font-bold text-c1 text-sm">Copy your key now. You won't see it again.</p>
      <TextInput
        id={id}
        ref={inputRef}
        label="Your new API key"
        wrapperClassName="gap-2"
        readOnly
        value={apiKey}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono"
      />
      <CopyButton
        text={apiKey}
        label="Copy"
        copiedMessage="Key copied."
        failedMessage="Couldn't copy. Select the key and copy it by hand."
      />
      <Button variant="ghost" className="self-start" onClick={onSaved}>
        I've saved it
      </Button>
    </>
  );
}
