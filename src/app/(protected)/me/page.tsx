/**
 * @file src/app/(protected)/me/page.tsx
 * @desc /me: saved packs (OWN_PAGE_SIZE a page, ?page=), API key, sign out, your data. Admins
 *       have no saved-pack cap, so their count shows no limit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { Metadata } from "next";
import { ApiKeyCard } from "@/components/account/ApiKeyCard";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { DownloadDataLink } from "@/components/account/DownloadDataLink";
import { RestoreSignedIn } from "@/components/auth/RestoreSignedIn";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { MyPacksList } from "@/components/pack/MyPacksList";
import { Pagination } from "@/components/packs/Pagination";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { MAX_SAVED_PACKS } from "@/constants/pack";
import { requireUser } from "@/lib/auth-session";
import { getApiKeyInfo } from "@/services/api-keys";
import { listPacks } from "@/services/packs";
import { parsePageParam } from "@/utils/paging";

export const metadata: Metadata = { title: "My packs", robots: { index: false } };

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

const myPacksHref = (page: number): string => (page <= 1 ? "/me" : `/me?page=${page}`);

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
        lead={`Signed in as ${user.username}.`}
        actions={
          <>
            {user.isAdmin ? (
              <ButtonLink href="/admin" variant="secondary">
                Admin
              </ButtonLink>
            ) : null}
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
          <Pagination page={page} pageCount={pageCount} href={myPacksHref} />
        </div>
      </Card>
      <ApiKeyCard initial={apiKey} />
      <Card title="Your data">
        <div className="flex flex-col gap-3">
          <p className="text-c3 text-sm">
            Download a copy of everything we store about your account: your osu! profile details,
            your sign-in sessions, your API key's prefix and dates, and every pack you saved.
          </p>
          <DownloadDataLink />
        </div>
        <div className="mt-6 flex flex-col gap-3 border-b3 border-t pt-6">
          <p className="text-c3 text-sm">
            Deleting your account removes it, your sessions, your API key, and every pack you saved.
            Files you downloaded and torrents you seed stay on your devices, so they aren't ours to
            delete.
          </p>
          <DeleteAccountButton packCount={total} />
        </div>
      </Card>
    </div>
  );
}
