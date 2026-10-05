/**
 * @file src/app/(protected)/p/[slug]/edit/page.tsx
 * @desc Edit a saved pack. Anyone but the owner gets a 404. Below the editor: a link to the
 *       pack's history and the owner's toggle for who else can see it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { LinkRow } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryVisibilityForm } from "@/components/history/HistoryVisibilityForm";
import { SavedPackEditor } from "@/components/pack/SavedPackEditor";
import { SEO_SITE } from "@/constants/seo";
import { requireUser } from "@/lib/auth-session";
import { getPackForViewer } from "@/services/pack-reads";

/**
 * @function generateMetadata
 * @param props {object} the route params
 * @returns {Promise<Metadata>} "Edit pack", noindex, with its own canonical URL
 */
export async function generateMetadata({ params }: PageProps<"/p/[slug]/edit">): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(SEO_SITE, {
    path: `/p/${encodeURIComponent(slug)}/edit`,
    title: "Edit pack",
    index: false,
  });
}

/**
 * @function EditPackPage
 * @param props {PageProps<"/p/[slug]/edit">} params
 * @returns {Promise<JSX.Element>} the page
 */
export default async function EditPackPage({ params }: PageProps<"/p/[slug]/edit">) {
  const { slug } = await params;
  const user = await requireUser(`/p/${slug}/edit`);
  const found = await getPackForViewer(slug, user.id);
  if (!found?.isOwner) notFound();
  return (
    <div className="flex flex-col gap-6">
      <SavedPackEditor pack={found.pack} />
      <LinkRow items={[{ href: `/p/${slug}/history`, label: "History" }]} />
      <HistoryVisibilityForm slug={slug} historyPublic={found.pack.historyPublic === true} />
    </div>
  );
}
