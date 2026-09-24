/**
 * @file src/components/pack/ShortLinkField.tsx
 * @desc Copyable /p/{slug} link. Starts from the production origin and switches to the current
 *       one after mount, so previews and localhost show links that work there.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button, fieldClasses } from "@haruhimemoe/ui";
import { useEffect, useId, useState } from "react";
import { SITE } from "@/constants/site";

export function ShortLinkField({ slug }: { slug: string }) {
  const id = useId();
  const [origin, setOrigin] = useState<string>(SITE.url);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/p/${slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copied.");
    } catch {
      setStatus("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-bold text-c3 text-sm">
        Short link
      </label>
      <input
        id={id}
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className={fieldClasses("font-mono")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copy}>Copy link</Button>
        <output className="text-c3 text-sm">{status}</output>
      </div>
    </div>
  );
}
