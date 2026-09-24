/**
 * @file src/app/(protected)/p/[slug]/edit/not-found.tsx
 * @desc 404 for /p/[slug]/edit: unknown, deleted, or not yours.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { PackNotFound } from "@/components/pack/PackNotFound";

export default function NotFound() {
  return <PackNotFound />;
}
