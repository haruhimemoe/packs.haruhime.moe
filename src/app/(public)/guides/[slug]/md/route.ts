/**
 * @file src/app/(public)/guides/[slug]/md/route.ts
 * @desc The Markdown mirror of a guides page, served at /guides/<slug>.md (next.config.ts
 *       rewrites it here) for AI assistants (llms.txt links it) and "Copy as Markdown". Static;
 *       unregistered slugs never build and answer 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Mon Oct 5, 2026
 */

import { contentParams } from "@haruhimemoe/next-kit/docs";
import { readContentMarkdown } from "@haruhimemoe/next-kit/docs/files";
import { textResponse } from "@haruhimemoe/next-kit/seo";
import { CONTENT } from "@/constants/content";
import { CONTENT_MARKDOWN } from "@/utils/content-markdown";

export const dynamic = "force-static";
export const dynamicParams = false;

/**
 * @function generateStaticParams
 * @returns {{ slug: string }[]} one param per registered guides page
 */
export const generateStaticParams = () => contentParams(CONTENT, "guides");

/**
 * @function GET
 * @param _request {Request} the incoming request
 * @param context {RouteContext<"/guides/[slug]/md">} the route segment
 * @returns {Promise<Response>} 200 text/markdown, or 404 for an unregistered slug
 */
export async function GET(_request: Request, { params }: RouteContext<"/guides/[slug]/md">) {
  const { slug } = await params;
  const md = await readContentMarkdown(CONTENT, "guides", slug, CONTENT_MARKDOWN);
  // Explicit 404: notFound() in route handlers misbehaves on Next 16 (AGENTS.md 6a).
  if (md === null) return new Response("Not found.\n", { status: 404 });
  return textResponse(md, { type: "text/markdown" });
}
