/**
 * @file src/app/(public)/legal/[slug]/page.tsx
 * @desc One legal page: the registry entry's title, description and last update, the MDX
 *       body, a "Copy as Markdown" button for its .md mirror. Static params from the
 *       registry; anything else 404s.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Mon Oct 5, 2026
 */

import { contentParams, contentPath, findEntry, markdownPath } from "@haruhimemoe/next-kit/docs";
import { notFoundMetadata, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { ContentPage } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";
import { LOADERS } from "@/content/load";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

/**
 * @function generateStaticParams
 * @returns {{ slug: string }[]} one param per registered legal page
 */
export const generateStaticParams = () => contentParams(CONTENT, "legal");

/**
 * @function generateMetadata
 * @param props {Props} the route params
 * @returns {Promise<Metadata>} the page's title, description, canonical and article date
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = findEntry(CONTENT, "legal", slug);
  if (!entry) return notFoundMetadata(SEO_SITE, "Page");
  return pageMetadata(SEO_SITE, {
    path: contentPath("legal", slug),
    title: `packs ${entry.title}`,
    description: entry.description,
    ogType: "article",
    modifiedTime: entry.lastUpdated,
  });
}

/**
 * @function LegalPage
 * @param props {Props} the route params
 * @returns {Promise<JSX.Element>} the page in ContentPage
 * @throws {Error} Next's 404 for a slug that isn't registered
 */
export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const entry = findEntry(CONTENT, "legal", slug);
  const load = LOADERS.legal?.[slug];
  if (!entry || !load) notFound();
  const { default: Body } = await load();
  return (
    <ContentPage
      title={entry.title}
      description={entry.description}
      lastUpdated={entry.lastUpdated}
      markdownHref={markdownPath("legal", slug)}
      proseSize="sm"
    >
      <Body />
    </ContentPage>
  );
}
