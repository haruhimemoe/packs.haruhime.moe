/**
 * @file src/app/(public)/p/[slug]/history/page.tsx
 * @desc /p/[slug]/history: every saved version of a pack and one version's changes. Dynamic (it
 *       reads the session), unlike /p/[slug] itself. A pack the caller can't see 404s; one they
 *       can see but whose history is private answers with a plain notice instead.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { EmptyState, LinkRow, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChangeList } from "@/components/history/ChangeList";
import { HistoryTable } from "@/components/history/HistoryTable";
import { HistoryVisibilityForm } from "@/components/history/HistoryVisibilityForm";
import { HISTORY_COPY } from "@/constants/history";
import { SEO_SITE } from "@/constants/seo";
import { getCurrentUser } from "@/lib/auth-session";
import { slugSchema } from "@/schemas/saved-pack";
import { loadPackHistory, loadPackRevision } from "@/services/pack-history-read";
import { packChangeLines } from "@/utils/pack-changes";

/**
 * @function generateMetadata
 * @param props {PageProps<"/p/[slug]/history">} the route params
 * @returns {Promise<Metadata>} "<pack name> history", never indexed
 */
export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]/history">): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentUser();
  const loaded = await loadPackHistory(slug, user);
  return pageMetadata(SEO_SITE, {
    path: `/p/${encodeURIComponent(slug)}/history`,
    title: loaded.ok ? `${loaded.value.pack.name} history` : "Pack history",
    index: false,
  });
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const seqParam = (value: string | string[] | undefined): number | undefined => {
  const raw = first(value);
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  return Number(raw);
};

/**
 * @function PackHistoryPage
 * @param props {PageProps<"/p/[slug]/history">} the pack's slug, and `rev` and `before` from the
 *        query
 * @returns {Promise<JSX.Element>} the versions and one version's changes; a pack with private
 *          history says so; a pack the caller can't see at all is a 404
 */
export default async function PackHistoryPage({
  params,
  searchParams,
}: PageProps<"/p/[slug]/history">) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();
  const query = await searchParams;
  const user = await getCurrentUser();
  const history = await loadPackHistory(slug, user, seqParam(query.before));
  if (!history.ok) {
    if (history.status !== 403) notFound();
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Pack history" />
        <EmptyState variant="filled" title={HISTORY_COPY.privateTitle}>
          {HISTORY_COPY.privateBody}
        </EmptyState>
      </div>
    );
  }
  const { pack, access, revisions, older, historyPublic } = history.value;
  const selected = first(query.rev) ?? revisions[0]?.id;
  const shown = selected ? await loadPackRevision(slug, user, selected) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`History of ${pack.name}`} />
      <LinkRow items={[{ href: `/p/${slug}`, label: "Back to the pack" }]} />
      {access.canToggle ? (
        <HistoryVisibilityForm slug={slug} historyPublic={historyPublic} />
      ) : null}
      {shown?.ok ? (
        <ChangeList
          revision={shown.value.revision}
          lines={
            shown.value.before
              ? packChangeLines(shown.value.changes, shown.value.before, shown.value.after)
              : null
          }
        />
      ) : null}
      <HistoryTable slug={slug} revisions={revisions} selected={selected} older={older} />
    </div>
  );
}
