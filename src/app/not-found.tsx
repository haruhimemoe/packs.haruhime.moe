/**
 * @file src/app/not-found.tsx
 * @desc 404 page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { ButtonLink, PageHeader } from "@haruhimemoe/ui";

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
