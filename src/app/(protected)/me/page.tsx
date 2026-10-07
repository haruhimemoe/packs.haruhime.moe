/**
 * @file src/app/(protected)/me/page.tsx
 * @desc /me, packs' own settings: saved packs (OWN_PAGE_SIZE a page, ?page=), API key, your data
 *       and "Delete my packs data", with Sign out (in place) and the one link to the haruhime.moe
 *       account (sessions, deleting it). Admins have no saved-pack cap, so their count
 *       shows no limit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { ButtonLink, Card, PageHeader, Pagination, Text } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { ApiKeyCard } from "@/components/account/ApiKeyCard";
import { DeletePacksDataButton } from "@/components/account/DeletePacksDataButton";
import { DownloadDataLink } from "@/components/account/DownloadDataLink";
import { SignOutButton } from "@/components/account/SignOutButton";
import { MyPacksList } from "@/components/pack/MyPacksList";
import { MAX_SAVED_PACKS } from "@/constants/pack";
import { SEO_SITE } from "@/constants/seo";
import { HUB_ACCOUNT_URL } from "@/constants/site";
import { RestoreSignedIn } from "@/lib/account";
import { requireUser } from "@/lib/auth-session";
import { getApiKeyInfo } from "@/services/api-keys";
import { listPacks } from "@/services/pack-reads";
import { parsePageParam } from "@/utils/paging";

export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/me",
  title: "My packs",
  index: false,
});

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

const myPacksHref = (page: number): string => (page <= 1 ? "/me" : `/me?page=${page}`);

/**
 * @function MyPacksPage
 * @param props {PageProps<"/me">} searchParams
 * @returns {Promise<JSX.Element>} the page
 */
export default async function MyPacksPage({ searchParams }: PageProps<"/me">) {
  const user = await requireUser("/me");
  const page = parsePageParam(first((await searchParams).page)) ?? 1;
  const [{ packs, pageCount, total }, apiKey] = await Promise.all([
    listPacks(user.id, page),
    getApiKeyInfo(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <RestoreSignedIn />
      <PageHeader
        title="My packs"
        lead={`Signed in as ${user.username}. This page is your packs settings.`}
        actions={
          <>
            {user.isAdmin ? (
              <ButtonLink href="/admin" variant="secondary">
                Admin
              </ButtonLink>
            ) : null}
            <ButtonLink href={HUB_ACCOUNT_URL} variant="secondary">
              haruhime.moe account
            </ButtonLink>
            <SignOutButton />
          </>
        }
      />
      <Card
        title={
          user.isAdmin ? `Saved packs (${total})` : `Saved packs (${total}/${MAX_SAVED_PACKS})`
        }
      >
        <div className="flex flex-col gap-4">
          <MyPacksList packs={packs} total={total} />
          <Pagination
            page={page}
            pageCount={pageCount}
            hrefFor={myPacksHref}
            previousLabel="Newer"
            nextLabel="Older"
          />
        </div>
      </Card>
      <ApiKeyCard initial={apiKey} />
      <Card title="Your data">
        <div className="flex flex-col gap-3">
          <Text tone="muted">
            Download a copy of everything packs stores about you: your osu! profile details, your
            API key's prefix and dates, and every pack you saved. Your sessions and deleting your
            haruhime account are on your haruhime.moe account.
          </Text>
          <DownloadDataLink />
        </div>
        <div className="mt-6 flex flex-col gap-3 border-b3 border-t pt-6">
          <Text tone="muted">
            Deleting your packs data removes your API key and every pack you saved, with their
            history. Your haruhime account stays. Files you downloaded and torrents you seed stay on
            your devices, so they aren't ours to delete.
          </Text>
          <DeletePacksDataButton username={user.username} packCount={total} />
        </div>
      </Card>
    </div>
  );
}
