/**
 * @file src/utils/content-markdown.ts
 * @desc The `{ siteUrl, transforms }` values every `readContentMarkdown` call passes, so the
 *       docs, guides and legal `.md` mirrors and `/llms-full.txt` all turn ui's MDX element
 *       overrides (Figure, and the rest) back into plain Markdown the same way.
 *       `CONTENT_MARKDOWN_LEGAL` additionally runs `legalMarkdownTransform` first, so next-kit's
 *       legal blocks (`<LegalContact />`, `<Processors />`, ...) turn into real Markdown instead
 *       of being dropped as unknown JSX; it's scoped to the legal section only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { legalMarkdownTransform } from "@haruhimemoe/next-kit/legal";
import { mdxMarkdownTransforms } from "@haruhimemoe/ui/remark";
import { LEGAL_SITE } from "@/constants/legal-site";
import { SITE } from "@/constants/site";

/** The siteUrl and MDX-to-Markdown transforms every `readContentMarkdown` call shares. */
export const CONTENT_MARKDOWN = { siteUrl: SITE.url, transforms: mdxMarkdownTransforms } as const;

/** `CONTENT_MARKDOWN`, plus `legalMarkdownTransform` run first: for the legal section only. */
export const CONTENT_MARKDOWN_LEGAL = {
  siteUrl: SITE.url,
  transforms: [legalMarkdownTransform(LEGAL_SITE), ...mdxMarkdownTransforms],
} as const;
