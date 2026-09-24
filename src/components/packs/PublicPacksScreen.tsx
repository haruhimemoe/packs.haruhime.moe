/**
 * @file src/components/packs/PublicPacksScreen.tsx
 * @desc /packs body (server-rendered): heading, then the search and filter bar over the server
 *       list and its paging (PublicPackBrowser swaps the list for filtered results). Packs admins
 *       pinned show in a "Pinned" row above the list, as the same cards in pin order, on every
 *       page of the plain list; any search, filter or sort replaces both.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { PageHeader, Pagination } from "@haruhimemoe/ui";
import { PublicPackBrowser } from "@/components/packs/PublicPackBrowser";
import { PublicPackList } from "@/components/packs/PublicPackList";
import type { PublicPackCard, PublicPackPage } from "@/schemas/public-pack";
import { publicPageHref } from "@/utils/paging";

type PublicPacksScreenProps = PublicPackPage & {
  /** Pinned packs in pin order (listPinnedPacks). Empty or absent: no pinned row. */
  pinned?: readonly PublicPackCard[];
};

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
            : `${total} ${total === 1 ? "pack" : "packs"} shared by hosts.`
        }
      />
      <PublicPackBrowser>
        {pinned.length === 0 ? (
          list
        ) : (
          <div className="flex flex-col gap-8">
            <section aria-labelledby="pinned-packs" className="flex flex-col gap-4">
              <h2 id="pinned-packs" className="font-bold text-c1 text-xl">
                Pinned
              </h2>
              <PublicPackList packs={pinned} />
            </section>
            <section aria-labelledby="all-packs" className="flex flex-col gap-4">
              <h2 id="all-packs" className="font-bold text-c1 text-xl">
                All packs
              </h2>
              {list}
            </section>
          </div>
        )}
      </PublicPackBrowser>
    </div>
  );
}
