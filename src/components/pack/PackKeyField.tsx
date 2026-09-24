/**
 * @file src/components/pack/PackKeyField.tsx
 * @desc Shows a pack key with copy buttons for the key and a /k#<key> share link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button, TextInput } from "@haruhimemoe/ui";
import { useId, useState } from "react";

type Copied = "key" | "link" | "failed" | null;

const STATUS: Record<Exclude<Copied, null>, string> = {
  key: "Key copied.",
  link: "Link copied.",
  failed: "Couldn't copy. Select the key and copy it by hand.",
};

export function PackKeyField({ packKey }: { packKey: string }) {
  const [copied, setCopied] = useState<Copied>(null);
  const id = useId();

  const copy = async (what: "key" | "link") => {
    const text = what === "key" ? packKey : `${window.location.origin}/k#${packKey}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied("failed");
    }
  };

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
        <Button onClick={() => copy("key")}>Copy key</Button>
        <Button variant="secondary" onClick={() => copy("link")}>
          Copy share link
        </Button>
        <output className="text-c3 text-sm">{copied ? STATUS[copied] : ""}</output>
      </div>
    </div>
  );
}
