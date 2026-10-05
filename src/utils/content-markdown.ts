/**
 * @file src/utils/content-markdown.ts
 * @desc The one `{ siteUrl, transforms }` value every `readContentMarkdown` call passes, so the
 *       docs, guides and legal `.md` mirrors and `/llms-full.txt` all turn ui's MDX element
 *       overrides (Figure, and the rest) back into plain Markdown the same way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { mdxMarkdownTransforms } from "@haruhimemoe/ui/remark";
import { SITE } from "@/constants/site";

/** The siteUrl and MDX-to-Markdown transforms every `readContentMarkdown` call shares. */
export const CONTENT_MARKDOWN = { siteUrl: SITE.url, transforms: mdxMarkdownTransforms } as const;
