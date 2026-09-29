/**
 * @file src/app/llms.txt/route.ts
 * @desc GET /llms.txt: a map of the site for AI assistants (llmstxt.org). Static; rebuilt on
 *       deploy, which is when the registries it reads can change. robots.txt allows it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { textResponse } from "@haruhimemoe/next-kit/seo";
import { buildLlmsTxt } from "@/utils/llms-txt";

export const dynamic = "force-static";

/**
 * @function GET
 * @returns {Response} 200 text/plain, cached an hour in browsers and a day on the CDN
 */
export function GET() {
  return textResponse(buildLlmsTxt(), { maxAge: 3600, sMaxAge: 86400 });
}
