/**
 * @file src/app/(public)/p/[slug]/not-found.tsx
 * @desc 404 for /p/[slug]: cached "Pack not found", with the owner's private/hidden pack loaded
 *       in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { PackNotFoundFallback } from "@/components/pack/PackNotFoundFallback";

export default function NotFound() {
  return <PackNotFoundFallback />;
}
