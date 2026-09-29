/**
 * @file src/app/(public)/p/[slug]/page.tsx
 * @desc /p/[slug]: a saved public or unlisted pack, cached (ISR) and revalidated on every change.
 *       Reads no cookies; owners get their controls, and private/hidden packs, in the browser. The
 *       maps' titles come from the mirror at render (lookupPageMeta), so the cached HTML names
 *       every map for crawlers and first paint; public packs also carry CreativeWork JSON-LD.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { notFoundMetadata } from "@haruhimemoe/next-kit/seo";
import { JsonLd } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SavedPackView } from "@/components/pack/SavedPackView";
import { SEO_SITE } from "@/constants/seo";
import { lookupPageMeta } from "@/lib/pack-stats";
import { getPackForViewer } from "@/services/pack-reads";
import { packLd, packMetadata } from "@/utils/pack-metadata";

// Pages render on first request and stay cached; every pack write revalidates its slug.
export const revalidate = 86400;

/**
 * @function generateStaticParams
 * @returns {Promise<object[]>} every path to prerender at build time
 */
export function generateStaticParams() {
  return [];
}

// Anonymous on purpose: private and hidden packs are "not found" in the cache.
const load = cache((slug: string) => getPackForViewer(slug, null));

/**
 * @function generateMetadata
 * @param props {object} the route params
 * @returns {Promise<Metadata>} the page's title, description and links
 */
export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  return found ? packMetadata(found.pack) : notFoundMetadata(SEO_SITE, "Pack");
}

/**
 * @function SavedPackPage
 * @param props {PageProps<"/p/[slug]">} params
 * @returns {Promise<JSX.Element>} the page
 */
export default async function SavedPackPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { pack } = found;
  const initialMeta = await lookupPageMeta(pack.slots.map((slot) => slot.beatmapId));
  const data = packLd(pack);
  return (
    <>
      <SavedPackView pack={pack} initialMeta={initialMeta} />
      {data ? <JsonLd data={data} /> : null}
    </>
  );
}
