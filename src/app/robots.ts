/**
 * @file src/app/robots.ts
 * @desc robots.txt: everything is crawlable (search engines and AI assistants alike) except the
 *       API (its OpenAPI document stays crawlable), account pages, and edit pages. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import type { MetadataRoute } from "next";
import { OPENAPI_PATH } from "@/constants/api";
import { SITE } from "@/constants/site";

/**
 * @function robots
 * @returns {MetadataRoute.Robots} robots.txt: everything allowed but the private and API paths, and the sitemap
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Longest match wins (RFC 9309): the OpenAPI document stays crawlable under /api/.
        allow: ["/", OPENAPI_PATH],
        disallow: ["/api/", "/admin", "/me", "/signin", "/p/*/edit"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
