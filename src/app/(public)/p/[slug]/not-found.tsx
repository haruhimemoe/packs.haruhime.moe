/**
 * @file src/app/(public)/p/[slug]/not-found.tsx
 * @desc 404 for /p/[slug]: cached "Pack not found", with the owner's private/hidden pack loaded
 *       in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { PackNotFoundFallback } from "@/components/pack/PackNotFoundFallback";

/**
 * @function NotFound
 * @returns {JSX.Element} the not-found page
 */
export default function NotFound() {
  return <PackNotFoundFallback />;
}
