/**
 * @file src/app/llms-full.txt/route.ts
 * @desc GET /llms-full.txt: every guide, then every doc, as one Markdown file for AI assistants
 *       (the long companion to /llms.txt). Static; rebuilt on deploy, when the text can change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { llmsFull, textResponse } from "@haruhimemoe/next-kit/seo";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";
import { SITE } from "@/constants/site";
import { readDocMarkdown, readGuideMarkdown } from "@/lib/docs";

export const dynamic = "force-static";

/** llmsFull writes each part's title as its H1, so the file's own goes. */
const withoutTitle = (markdown: string): string => markdown.replace(/^# .*\n+/, "");

/**
 * @function GET
 * @returns {Promise<Response>} 200 text/markdown: the guides and docs, each under its title and
 *          source URL
 */
export async function GET() {
  const guides = await Promise.all(
    GUIDE_SLUGS.map(async (slug) => ({
      title: GUIDE_DOCS[slug].title,
      url: `${SITE.url}/guide/${slug}`,
      markdown: withoutTitle(await readGuideMarkdown(slug)),
    })),
  );
  const docs = await Promise.all(
    DOC_SLUGS.map(async (slug) => ({
      title: DOC_DOCS[slug].title,
      url: `${SITE.url}/docs/${slug}`,
      markdown: withoutTitle(await readDocMarkdown(slug)),
    })),
  );
  return textResponse(
    llmsFull([...guides, ...docs], {
      title: `${SITE.title} guides and docs`,
      summary: SITE.description,
    }),
    { type: "text/markdown", maxAge: 3600, sMaxAge: 86400 },
  );
}
