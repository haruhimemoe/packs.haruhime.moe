/**
 * @file src/app/(protected)/p/[slug]/edit/page.tsx
 * @desc Edit a saved pack. Anyone but the owner gets a 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  return <SavedPackEditor pack={found.pack} />;
}
