/**
 * @file src/app/(public)/packs/page/[n]/page.tsx
 * @desc /packs/page/{n} for n ≥ 2 (page 1 redirects to /packs), under the same pinned row as
 *       /packs. ISR like /packs: each page is built on first visit and cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { notFoundMetadata, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { JsonLd } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicPacksScreen } from "@/components/packs/PublicPacksScreen";
import { SEO_SITE } from "@/constants/seo";
import { listPinnedPacks, listPublicPacks } from "@/services/public-packs";
import { packListLd } from "@/utils/pack-list-ld";
import { parsePublicPage, publicPageHref } from "@/utils/paging";

export const revalidate = 86400;

/**
 * @function generateStaticParams
 * @returns {Promise<{ n: string }[]>} no pages at build time: each is rendered on its first visit
 *          and then kept (ISR)
 */
export const generateStaticParams = async (): Promise<{ n: string }[]> => [];

/**
 * @function generateMetadata
 * @param props {object} the route params
 * @returns {Promise<Metadata>} the page's title, description and links
 */
export async function generateMetadata({
  params,
}: PageProps<"/packs/page/[n]">): Promise<Metadata> {
  const page = parsePublicPage((await params).n);
  if (!page) return notFoundMetadata(SEO_SITE, "Page");
  return pageMetadata(SEO_SITE, {
    path: publicPageHref(page),
    title: `Public osu! mappool packs, page ${page}`,
    description: `Page ${page} of the public osu! tournament mappool packs, newest first. Filter by star rating, length, BPM and mods, and download a pool as one zip or a torrent.`,
  });
}

/**
 * @function PublicPacksPageN
 * @param props {PageProps<"/packs/page/[n]">} params
 * @returns {Promise<JSX.Element>} the page
 */
export default async function PublicPacksPageN({ params }: PageProps<"/packs/page/[n]">) {
  const page = parsePublicPage((await params).n);
  if (page === null) notFound();
  if (page === 1) permanentRedirect("/packs");
  const [result, pinned] = await Promise.all([listPublicPacks(page), listPinnedPacks()]);
  if (page > result.pageCount) notFound();
  return (
    <>
      <PublicPacksScreen {...result} pinned={pinned} />
      <JsonLd data={packListLd(result.packs, publicPageHref(page), page)} />
    </>
  );
}
