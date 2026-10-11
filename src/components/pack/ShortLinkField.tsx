/**
 * @file src/components/pack/ShortLinkField.tsx
 * @desc Copyable /p/{slug} link on @haruhimemoe/ui's CopyField. Starts from the production origin
 *       and switches to the current one after mount, so previews and localhost show links that
 *       work there.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { CopyField } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SITE } from "@/constants/site";

/**
 * @function ShortLinkField
 * @param props {{ slug: string }} the saved pack's slug
 * @returns {JSX.Element} copyable /p/{slug} link
 */
export function ShortLinkField({ slug }: { slug: string }) {
  const t = useTranslations("packs.shortLinkField");
  const [origin, setOrigin] = useState<string>(SITE.url);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/p/${slug}`;

  return (
    <CopyField
      label={t("shortLink")}
      value={link}
      copyLabel={t("copyLink")}
      copyVariant="primary"
      copiedMessage={t("linkCopied")}
      failedMessage={t("couldnTCopySelect")}
    />
  );
}
