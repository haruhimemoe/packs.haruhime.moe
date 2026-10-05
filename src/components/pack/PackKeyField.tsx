/**
 * @file src/components/pack/PackKeyField.tsx
 * @desc The pack key on @haruhimemoe/ui's CopyField, read-only and selected on focus, with a
 *       second CopyButton for a share link on this site's origin (known once the page runs in the
 *       browser).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { CopyButton, CopyField } from "@haruhimemoe/ui";
import { useEffect, useState } from "react";

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

  return (
    <CopyField
      label="Pack key"
      value={packKey}
      copyLabel="Copy key"
      copyVariant="primary"
      copiedMessage="Key copied."
      failedMessage={FAILED}
      actions={
        <CopyButton
          text={origin === null ? "" : `${origin}/k#${packKey}`}
          disabled={origin === null}
          label="Copy share link"
          copiedMessage="Link copied."
          failedMessage={FAILED}
        />
      }
    />
  );
}
