/**
 * @file tests/unit/utils/content-markdown.test.ts
 * @desc CONTENT_MARKDOWN feeds ui's MDX element overrides (Figure, and the rest) through
 *       mdxMarkdownTransforms so the .md mirrors turn them back into plain Markdown.
 *       CONTENT_MARKDOWN_LEGAL additionally runs legalMarkdownTransform first, so next-kit's
 *       legal blocks survive the legal section's .md mirrors and llms-full.txt too.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { mdxToMarkdown } from "@haruhimemoe/next-kit/docs";
import { expect, it } from "vitest";
import { CONTENT_MARKDOWN, CONTENT_MARKDOWN_LEGAL } from "@/utils/content-markdown";

it("turns ui's MDX components into Markdown in the mirrors", () => {
  const md = mdxToMarkdown('<Figure src="/a.png" alt="A" width={1} height={1} caption="C" />', {
    title: "T",
    ...CONTENT_MARKDOWN,
  });
  expect(md).toContain(`![A](${CONTENT_MARKDOWN.siteUrl}/a.png "C")`);
});

it("turns next-kit's legal blocks into Markdown in the legal mirrors", () => {
  const md = mdxToMarkdown("<Processors />\n\n<YourRights />", {
    title: "T",
    ...CONTENT_MARKDOWN_LEGAL,
  });
  expect(md).toContain("## Service providers");
  expect(md).toContain("Vercel");
  expect(md).toContain("Your rights under the GDPR");
  expect(md).not.toContain("<Processors");
  expect(md).not.toContain("<YourRights");
});
