/**
 * @file src/app/(protected)/p/[slug]/edit/not-found.tsx
 * @desc 404 for /p/[slug]/edit: unknown, deleted, or not yours.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { PackNotFound } from "@/components/pack/PackNotFound";

/**
 * @function NotFound
 * @returns {JSX.Element} the not-found page
 */
export default function NotFound() {
  return <PackNotFound />;
}
