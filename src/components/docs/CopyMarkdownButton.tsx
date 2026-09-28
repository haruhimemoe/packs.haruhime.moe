/**
 * @file src/components/docs/CopyMarkdownButton.tsx
 * @desc Doc page header control: links the .md URL and copies the doc as Markdown (text handed
 *       down by the server page, so no extra request) with @haruhimemoe/ui's CopyButton.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { CopyButton, TextLink } from "@haruhimemoe/ui";

type CopyMarkdownButtonProps = {
  /** The doc's Markdown source. */
  markdown: string;
  /** Where the same Markdown is served (/docs/<slug>.md). */
  href: string;
};

/**
 * @function CopyMarkdownButton
 * @param props {CopyMarkdownButtonProps} the doc's Markdown and its .md URL
 * @returns {JSX.Element} a "View as Markdown" link and a "Copy as Markdown" button with its status
 */
export function CopyMarkdownButton({ markdown, href }: CopyMarkdownButtonProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CopyButton
        text={markdown}
        label="Copy as Markdown"
        failedMessage="Couldn't copy. Open the Markdown instead."
      />
      <TextLink href={href} className="text-sm">
        View as Markdown
      </TextLink>
    </div>
  );
}
