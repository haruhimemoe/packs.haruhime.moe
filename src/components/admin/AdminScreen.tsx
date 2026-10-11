/**
 * @file src/components/admin/AdminScreen.tsx
 * @desc /admin body: All / Hidden tabs, a name filter (plain GET form), the table, paging, the
 *       pinned packs panel, and the pack stats panel.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { Button, LinkTabs, PageHeader, Pagination, TextInput } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { AdminPackTable } from "@/components/admin/AdminPackTable";
import { PackStatsBackfill } from "@/components/admin/PackStatsBackfill";
import { PinnedPacks } from "@/components/admin/PinnedPacks";
import type { AdminPackPage, PinnedPack } from "@/schemas/public-pack";
import { adminHref } from "@/utils/paging";
import { countOf } from "@/utils/text";

type AdminScreenProps = AdminPackPage & {
  hiddenOnly: boolean;
  query: string;
  /** Every pinned pack, in pin order. */
  pins: readonly PinnedPack[];
};

/**
 * @function AdminScreen
 * @param props {AdminScreenProps} this page of packs, the filter and query, and the pinned packs
 * @returns {JSX.Element} /admin: All/Hidden tabs, the name filter, the pack table, pagination,
 *          the pinned packs, and the stats backfill
 */
export function AdminScreen({
  rows,
  page,
  pageCount,
  total,
  hiddenOnly,
  query,
  pins,
}: AdminScreenProps) {
  const t = useTranslations("packs.adminScreen");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("admin")} lead={t("publicAndUnlistedPacks")} />
      <LinkTabs
        label={t("filter")}
        items={[
          { href: adminHref({ query }), label: "All", current: !hiddenOnly },
          { href: adminHref({ hiddenOnly: true, query }), label: "Hidden", current: hiddenOnly },
        ]}
      />
      <search>
        <form action="/admin" method="get" className="flex flex-wrap items-end gap-2">
          {hiddenOnly ? <input type="hidden" name="show" value="hidden" /> : null}
          <TextInput
            id="admin-query"
            label={t("packName")}
            wrapperClassName="min-w-48 flex-1"
            name="q"
            defaultValue={query}
          />
          <Button type="submit" variant="secondary">
            {t("filter")}
          </Button>
        </form>
      </search>
      <p className="text-c4 text-sm">{countOf(total, "pack")}</p>
      <AdminPackTable rows={rows} />
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(n) => adminHref({ page: n, hiddenOnly, query })}
        previousLabel={t("newer")}
        nextLabel={t("older")}
      />
      <PinnedPacks pins={pins} />
      <PackStatsBackfill />
    </div>
  );
}
