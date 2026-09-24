/**
 * @file src/components/packs/Pagination.tsx
 * @desc Newer / Older links with "Page X of Y". Renders nothing for a single page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { ButtonLink } from "@/components/ui/ButtonLink";

type PaginationProps = {
  page: number;
  pageCount: number;
  href: (page: number) => string;
};

export function Pagination({ page, pageCount, href }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <ButtonLink href={href(page - 1)} variant="secondary">
          Newer
        </ButtonLink>
      ) : (
        <span />
      )}
      <span className="text-c4">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <ButtonLink href={href(page + 1)} variant="secondary">
          Older
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
