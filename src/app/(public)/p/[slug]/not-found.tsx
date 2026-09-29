/**
 * @file src/app/(public)/p/[slug]/not-found.tsx
 * @desc 404 for /p/[slug]: cached "Pack not found", with the owner's private/hidden pack loaded
 *       in the browser. Its metadata is the page's title: under Next 16 the 404's server HTML is
 *       the empty error shell, which takes the nearest not-found's metadata (AGENTS.md, 6a).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { notFoundMetadata } from "@haruhimemoe/next-kit/seo";
import type { Metadata } from "next";
import { PackNotFoundFallback } from "@/components/pack/PackNotFoundFallback";
import { SEO_SITE } from "@/constants/seo";

/** "Pack not found · packs.haruhime.moe", noindex. */
export const metadata: Metadata = notFoundMetadata(SEO_SITE, "Pack");

/**
 * @function NotFound
 * @returns {JSX.Element} the not-found page
 */
export default function NotFound() {
  return <PackNotFoundFallback />;
}
