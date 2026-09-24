/**
 * @file src/components/pack/ShortLinkField.tsx
 * @desc Copyable /p/{slug} link. Starts from the production origin and switches to the current
 *       one after mount, so previews and localhost show links that work there.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { CopyButton, TextInput } from "@haruhimemoe/ui";
import { useEffect, useId, useState } from "react";
import { SITE } from "@/constants/site";

export function ShortLinkField({ slug }: { slug: string }) {
  const id = useId();
  const [origin, setOrigin] = useState<string>(SITE.url);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/p/${slug}`;

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        id={id}
        label="Short link"
        wrapperClassName="gap-2"
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono"
      />
      <CopyButton
        text={link}
        label="Copy link"
        copiedMessage="Link copied."
        failedMessage="Couldn't copy. Select the link and copy it by hand."
        variant="primary"
        wrapperClassName="gap-2"
      />
    </div>
  );
}
