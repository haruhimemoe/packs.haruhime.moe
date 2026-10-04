/**
 * @file src/app/llms-full.txt/route.ts
 * @desc GET /llms-full.txt: every docs, guides and legal page, in that order, as one Markdown
 *       file for AI assistants (the long companion to /llms.txt), from next-kit's
 *       contentLlmsFull over the content registry. Static; rebuilt on deploy, when the text can
 *       change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 4, 2026
 */

import { contentLlmsFull } from "@haruhimemoe/next-kit/docs";
import { readContentMarkdown } from "@haruhimemoe/next-kit/docs/files";
import { textResponse } from "@haruhimemoe/next-kit/seo";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";
import { SITE } from "@/constants/site";

export const dynamic = "force-static";

/**
 * @function GET
 * @returns {Promise<Response>} 200 text/markdown: every content page, each under its title and
 *          page URL
 */
export async function GET() {
  const body = await contentLlmsFull({
    site: SEO_SITE,
    title: `${SITE.title} docs, guides and legal pages`,
    summary: SITE.description,
    content: CONTENT,
    read: (s, slug) =>
      readContentMarkdown(CONTENT, s, slug, { siteUrl: SITE.url }).then((m) => m ?? ""),
  });
  return textResponse(body, { type: "text/markdown", maxAge: 3600, sMaxAge: 86400 });
}
