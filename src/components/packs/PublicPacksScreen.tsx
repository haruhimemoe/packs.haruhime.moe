/**
 * @file src/components/packs/PublicPacksScreen.tsx
 * @desc /packs body (server-rendered): heading, search over the server list, paging.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { PageHeader, Pagination } from "@haruhimemoe/ui";
import { PublicPackList } from "@/components/packs/PublicPackList";
import { PublicPackSearch } from "@/components/packs/PublicPackSearch";
import type { PublicPackPage } from "@/schemas/public-pack";
import { publicPageHref } from "@/utils/paging";

export function PublicPacksScreen({ packs, page, pageCount, total }: PublicPackPage) {
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
      <PublicPackSearch>
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
      </PublicPackSearch>
    </div>
  );
}
