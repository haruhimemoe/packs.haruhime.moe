/**
 * @file src/components/pack/PackNotFound.tsx
 * @desc 404 body for /p/[slug] and its edit page. Never says which of deleted / private / never
 *       existed applies, so private slugs aren't confirmed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { ButtonLink, PageHeader } from "@haruhimemoe/ui";

export function PackNotFound() {
  return (
    <PageHeader
      title="Pack not found"
      lead="This pack may have been deleted by its owner, or it's private. If someone shared its pack key with you, open that instead."
      actions={
        <>
          <ButtonLink href="/">Open a pack key</ButtonLink>
          <ButtonLink href="/new" variant="secondary">
            Build a pack
          </ButtonLink>
        </>
      }
    />
  );
}
