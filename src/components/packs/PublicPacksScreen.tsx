/**
 * @file src/components/packs/PublicPacksScreen.tsx
 * @desc /packs body (server-rendered): heading, then the search and filter bar over the server
 *       list and its paging (PublicPackBrowser swaps the list for filtered results). Packs admins
 *       pinned show in a "Pinned" row above the list, as the same cards in pin order, on every
 *       page of the plain list; any search, filter or sort replaces both.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import { PageHeader, Pagination, SectionHeading } from "@haruhimemoe/ui";
import { PublicPackBrowser } from "@/components/packs/PublicPackBrowser";
import { PublicPackList } from "@/components/packs/PublicPackList";
import type { PublicPackCard, PublicPackPage } from "@/schemas/public-pack";
import { publicPageHref } from "@/utils/paging";
import { countOf } from "@/utils/text";

type PublicPacksScreenProps = PublicPackPage & {
  /** Pinned packs in pin order (listPinnedPacks). Empty or absent: no pinned row. */
  pinned?: readonly PublicPackCard[];
};

/**
 * @function PublicPacksScreen
 * @param props {PublicPacksScreenProps} packs, pinned, page, pageCount, total
 * @returns {JSX.Element} /packs body (server-rendered)
 */
export function PublicPacksScreen({
  packs,
  pinned = [],
  page,
  pageCount,
  total,
}: PublicPacksScreenProps) {
  const list = (
    <div className="flex flex-col gap-4">
      <PublicPackList packs={packs} />
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={publicPageHref}
        previousLabel="Newer"
        nextLabel="Older"
      />
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Public packs"
        lead={
          total === 0
            ? "Packs hosts share publicly show up here."
            : `${countOf(total, "pack")} shared by hosts.`
        }
      />
      <PublicPackBrowser>
        {pinned.length === 0 ? (
          list
        ) : (
          <div className="flex flex-col gap-8">
            <section aria-labelledby="pinned-packs" className="flex flex-col gap-4">
              <SectionHeading id="pinned-packs">Pinned</SectionHeading>
              <PublicPackList packs={pinned} />
            </section>
            <section aria-labelledby="all-packs" className="flex flex-col gap-4">
              <SectionHeading id="all-packs">All packs</SectionHeading>
              {list}
            </section>
          </div>
        )}
      </PublicPackBrowser>
    </div>
  );
}
