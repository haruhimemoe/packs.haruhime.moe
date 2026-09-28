/**
 * @file src/components/pack/PackKeyField.tsx
 * @desc The pack key, read-only and selected on focus, with two @haruhimemoe/ui CopyButtons: the
 *       key, and a share link on this site's origin (known once the page runs in the browser).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { CopyButton, TextInput } from "@haruhimemoe/ui";
import { useEffect, useId, useState } from "react";

const FAILED = "Couldn't copy. Select the key and copy it by hand.";

/**
 * @function PackKeyField
 * @param props {{ packKey: string }} the encoded pack key
 * @returns {JSX.Element} the key field and its Copy key and Copy share link buttons
 */
export function PackKeyField({ packKey }: { packKey: string }) {
  // The origin is only known in the browser: the link button waits for it.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        id={id}
        label="Pack key"
        wrapperClassName="gap-2"
        readOnly
        value={packKey}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono"
      />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton
          text={packKey}
          label="Copy key"
          variant="primary"
          copiedMessage="Key copied."
          failedMessage={FAILED}
        />
        <CopyButton
          text={origin === null ? "" : `${origin}/k#${packKey}`}
          disabled={origin === null}
          label="Copy share link"
          copiedMessage="Link copied."
          failedMessage={FAILED}
        />
      </div>
    </div>
  );
}
