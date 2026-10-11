/**
 * @file src/components/pack/PackKeyField.tsx
 * @desc The pack key on @haruhimemoe/ui's CopyField, read-only and selected on focus, with a
 *       second CopyButton for a share link on this site's origin (known once the page runs in the
 *       browser).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { CopyButton, CopyField } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

const FAILED = (t: T) => t("couldnTCopySelect");

/**
 * @function PackKeyField
 * @param props {{ packKey: string }} the encoded pack key
 * @returns {JSX.Element} the key field and its Copy key and Copy share link buttons
 */
export function PackKeyField({ packKey }: { packKey: string }) {
  const t = useTranslations("packs.packKeyField");
  // The origin is only known in the browser: the link button waits for it.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <CopyField
      label={t("packKey")}
      value={packKey}
      copyLabel={t("copyKey")}
      copyVariant="primary"
      copiedMessage={t("keyCopied")}
      failedMessage={FAILED(t)}
      actions={
        <CopyButton
          text={origin === null ? "" : `${origin}/k#${packKey}`}
          disabled={origin === null}
          label={t("copyShareLink")}
          copiedMessage={t("linkCopied")}
          failedMessage={FAILED(t)}
        />
      }
    />
  );
}
