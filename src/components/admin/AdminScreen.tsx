/**
 * @file src/components/admin/AdminScreen.tsx
 * @desc /admin body: All / Hidden tabs, a name filter (plain GET form), the table, paging, the
 *       pinned packs panel, and the pack stats panel.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { Button, PageHeader, Pagination, TextInput } from "@haruhimemoe/ui";
import Link from "next/link";
import { AdminPackTable } from "@/components/admin/AdminPackTable";
import { PackStatsBackfill } from "@/components/admin/PackStatsBackfill";
import { PinnedPacks } from "@/components/admin/PinnedPacks";
import type { AdminPackPage, PinnedPack } from "@/schemas/public-pack";
import { cn } from "@/utils/cn";
import { adminHref } from "@/utils/paging";

type AdminScreenProps = AdminPackPage & {
  hiddenOnly: boolean;
  query: string;
  /** Every pinned pack, in pin order. */
  pins: readonly PinnedPack[];
};

const tabClasses = (active: boolean): string =>
  cn(
    "rounded-full px-3 py-1 font-bold text-sm transition-colors",
    active ? "bg-b3 text-c1" : "text-c3 hover:text-c1",
  );

export function AdminScreen({
  rows,
  page,
  pageCount,
  total,
  hiddenOnly,
  query,
  pins,
}: AdminScreenProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin" lead="Public and unlisted packs. Private packs never show here." />
      <nav aria-label="Filter" className="flex gap-2">
        <Link
          href={adminHref({ query })}
          aria-current={hiddenOnly ? undefined : "page"}
          className={tabClasses(!hiddenOnly)}
        >
          All
        </Link>
        <Link
          href={adminHref({ hiddenOnly: true, query })}
          aria-current={hiddenOnly ? "page" : undefined}
          className={tabClasses(hiddenOnly)}
        >
          Hidden
        </Link>
      </nav>
      <search>
        <form action="/admin" method="get" className="flex flex-wrap items-end gap-2">
          {hiddenOnly ? <input type="hidden" name="show" value="hidden" /> : null}
          <TextInput
            id="admin-query"
            label="Pack name"
            wrapperClassName="min-w-48 flex-1"
            name="q"
            defaultValue={query}
          />
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
      </search>
      <p className="text-c4 text-sm">
        {total} {total === 1 ? "pack" : "packs"}
      </p>
      <AdminPackTable rows={rows} />
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(n) => adminHref({ page: n, hiddenOnly, query })}
        previousLabel="Newer"
        nextLabel="Older"
      />
      <PinnedPacks pins={pins} />
      <PackStatsBackfill />
    </div>
  );
}
