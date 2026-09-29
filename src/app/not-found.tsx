/**
 * @file src/app/not-found.tsx
 * @desc 404 page, titled "Page not found · packs.haruhime.moe". Under Next 16 a page that calls
 *       notFound() serves an empty error shell with the nearest not-found's metadata and a 404; the browser renders
 *       the not-found UI (AGENTS.md, section 6a).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { notFoundMetadata } from "@haruhimemoe/next-kit/seo";
import { ButtonLink, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";

/** "Page not found · packs.haruhime.moe", noindex. */
export const metadata: Metadata = notFoundMetadata(SEO_SITE);

/**
 * @function NotFound
 * @returns {JSX.Element} the not-found page
 */
export default function NotFound() {
  return (
    <PageHeader
      title="Page not found"
      lead="That page doesn't exist, or it moved."
      actions={
        <ButtonLink href="/" variant="secondary">
          Back home
        </ButtonLink>
      }
    />
  );
}
