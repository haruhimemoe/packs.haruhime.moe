/**
 * @file src/app/(public)/packs/page/[n]/page.tsx
 * @desc /packs/page/{n} for n ≥ 2 (page 1 redirects to /packs), under the same pinned row as
 *       /packs. ISR like /packs: each page is built on first visit and cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicPacksScreen } from "@/components/packs/PublicPacksScreen";
import { listPinnedPacks, listPublicPacks } from "@/services/public-packs";
import { parsePublicPage, publicPageHref } from "@/utils/paging";

export const revalidate = 86400;

export const generateStaticParams = async (): Promise<{ n: string }[]> => [];

export async function generateMetadata({
  params,
}: PageProps<"/packs/page/[n]">): Promise<Metadata> {
  const page = parsePublicPage((await params).n);
  return page
    ? { title: `Public packs, page ${page}`, alternates: { canonical: publicPageHref(page) } }
    : { title: "Public packs" };
}

export default async function PublicPacksPageN({ params }: PageProps<"/packs/page/[n]">) {
  const page = parsePublicPage((await params).n);
  if (page === null) notFound();
  if (page === 1) permanentRedirect("/packs");
  const [result, pinned] = await Promise.all([listPublicPacks(page), listPinnedPacks()]);
  if (page > result.pageCount) notFound();
  return <PublicPacksScreen {...result} pinned={pinned} />;
}
