/**
 * @file src/app/robots.ts
 * @desc robots.txt: everything is crawlable (search engines and AI assistants alike, each AI
 *       crawler named in its own group so the stance is explicit) except the API (its OpenAPI
 *       document stays crawlable), account pages, and edit pages. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { robots } from "@haruhimemoe/next-kit/seo";
import type { MetadataRoute } from "next";
import { OPENAPI_PATH } from "@/constants/api";
import { SEO_SITE } from "@/constants/seo";

/**
 * @function robotsTxt
 * @returns {MetadataRoute.Robots} robots.txt: everything allowed but the private and API paths,
 *          AI crawlers allowed the same, and the sitemap
 */
export default function robotsTxt(): MetadataRoute.Robots {
  return robots(SEO_SITE, {
    // Longest match wins (RFC 9309): the OpenAPI document stays crawlable under /api/.
    allow: ["/", OPENAPI_PATH],
    disallow: ["/api/", "/admin", "/me", "/signin", "/p/*/edit"],
    aiBots: "allow",
  });
}
