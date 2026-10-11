/**
 * @file src/app/(public)/docs/[slug]/page.tsx
 * @desc One docs page: the registry entry's title, description and last update, the MDX
 *       body, a "Copy as Markdown" button for its .md mirror, JSON-LD (TechArticle, HowTo when it has steps, breadcrumbs). Static params from the
 *       registry; anything else 404s.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 11, 2026
 */

import { contentParams, contentPath, findEntry, markdownPath } from "@haruhimemoe/next-kit/docs";
import { notFoundMetadata, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { ContentPage } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";
import { LOADERS } from "@/content/load";
import { docJsonLd } from "@/utils/content-ld";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

/**
 * @function generateStaticParams
 * @returns {{ slug: string }[]} one param per registered docs page
 */
export const generateStaticParams = () => contentParams(CONTENT, "docs");

/**
 * @function generateMetadata
 * @param props {Props} the route params
 * @returns {Promise<Metadata>} the page's title, description, canonical and article date
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = findEntry(CONTENT, "docs", slug);
  if (!entry) return notFoundMetadata(SEO_SITE, "Page");
  return pageMetadata(SEO_SITE, {
    path: contentPath("docs", slug),
    title: `packs ${entry.title}`,
    description: entry.description,
    ogType: "article",
    modifiedTime: entry.lastUpdated,
  });
}

/**
 * @function DocPage
 * @param props {Props} the route params
 * @returns {Promise<JSX.Element>} the page in ContentPage
 * @throws {Error} Next's 404 for a slug that isn't registered
 */
export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const entry = findEntry(CONTENT, "docs", slug);
  const load = LOADERS.docs?.[slug];
  if (!entry || !load) notFound();
  const { default: Body } = await load();
  return (
    <ContentPage
      title={entry.title}
      description={entry.description}
      lastUpdated={entry.lastUpdated}
      markdownHref={markdownPath("docs", slug)}
      jsonLd={docJsonLd("docs", entry)}
    >
      <Body />
    </ContentPage>
  );
}
