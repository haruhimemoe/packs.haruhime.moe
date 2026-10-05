/**
 * @file tests/unit/utils/content-markdown.test.ts
 * @desc CONTENT_MARKDOWN feeds ui's MDX element overrides (Figure, and the rest) through
 *       mdxMarkdownTransforms so the .md mirrors turn them back into plain Markdown.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { mdxToMarkdown } from "@haruhimemoe/next-kit/docs";
import { expect, it } from "vitest";
import { CONTENT_MARKDOWN } from "@/utils/content-markdown";

it("turns ui's MDX components into Markdown in the mirrors", () => {
  const md = mdxToMarkdown('<Figure src="/a.png" alt="A" width={1} height={1} caption="C" />', {
    title: "T",
    ...CONTENT_MARKDOWN,
  });
  expect(md).toContain(`![A](${CONTENT_MARKDOWN.siteUrl}/a.png "C")`);
});
