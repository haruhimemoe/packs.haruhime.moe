/**
 * @file src/app/not-found.tsx
 * @desc 404 page, titled "Page not found · packs.haruhime.moe". Under Next 16 a page that calls
 *       notFound() serves an empty error shell with this metadata and a 404; the browser renders
 *       the not-found UI (AGENTS.md, section 6a).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { ButtonLink, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

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
