/**
 * @file src/app/llms.txt/route.ts
 * @desc GET /llms.txt: a map of the site for AI assistants (llmstxt.org). Static; rebuilt on
 *       deploy, which is when the registries it reads can change. robots.txt allows it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { buildLlmsTxt } from "@/utils/llms-txt";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
