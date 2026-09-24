/**
 * @file src/app/(public)/docs/[slug]/md/route.ts
 * @desc The Markdown copy of a doc. Served at /docs/<slug>.md (next.config.ts rewrites it here),
 *       for AI assistants (llms.txt links it) and anyone who wants the raw text. Static; unknown
 *       slugs 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { DOC_SLUGS, isDocSlug } from "@/constants/docs";
import { readDocMarkdown } from "@/lib/docs";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export async function GET(_request: Request, { params }: RouteContext<"/docs/[slug]/md">) {
  const { slug } = await params;
  if (!isDocSlug(slug)) return new Response("Not found.\n", { status: 404 });
  return new Response(await readDocMarkdown(slug), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
