/**
 * @file src/components/docs/CopyMarkdownButton.tsx
 * @desc Doc page header control: copies the doc as Markdown (text handed down by the server page,
 *       so no extra request) and links the .md URL. Same copy + <output> status pattern as the
 *       torrent export.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useState } from "react";

export function CopyMarkdownButton({ markdown, href }: { markdown: string; href: string }) {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={copy}>
        Copy as Markdown
      </Button>
      <a href={href} className="font-bold text-h1 text-sm hover:text-c1">
        View as Markdown
      </a>
      <output className="text-c3 text-sm">
        {copied === "copied"
          ? "Copied."
          : copied === "failed"
            ? "Couldn't copy. Open the Markdown instead."
            : ""}
      </output>
    </div>
  );
}
