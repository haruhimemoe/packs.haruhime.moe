/**
 * @file src/app/(public)/p/[slug]/page.tsx
 * @desc /p/[slug]: a saved public or unlisted pack, cached (ISR) and revalidated on every change.
 *       Reads no cookies; owners get their controls, and private/hidden packs, in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SavedPackView } from "@/components/pack/SavedPackView";
import { getPackForViewer } from "@/services/packs";
import { packMetadata } from "@/utils/pack-metadata";

// Pages render on first request and stay cached; every pack write revalidates its slug.
export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

// Anonymous on purpose: private and hidden packs are "not found" in the cache.
const load = cache((slug: string) => getPackForViewer(slug, null));

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  return found ? packMetadata(found.pack) : { title: "Pack not found", robots: { index: false } };
}

export default async function SavedPackPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  return <SavedPackView pack={found.pack} />;
}
