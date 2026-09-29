/**
 * @file src/app/(public)/guide/[slug]/page.tsx
 * @desc Guide document route. Static params from the registry; unknown slugs 404. Each guide
 *       carries TechArticle JSON-LD with its lastUpdated, HowTo steps when it has them, and
 *       breadcrumbs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { ld, notFoundMetadata, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { JsonLd, PageHeader, Prose } from "@haruhimemoe/ui";
import type { MDXContent } from "mdx/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDE_DOCS, GUIDE_SLUGS, type GuideSlug, isGuideSlug } from "@/constants/guide";
import { SEO_SITE } from "@/constants/seo";
import { formatIsoDate } from "@/utils/date";

const LOADERS: Record<GuideSlug, () => Promise<{ default: MDXContent }>> = {
  "download-a-torrent": () => import("@content/guide/download-a-torrent.mdx"),
  "make-a-pack": () => import("@content/guide/make-a-pack.mdx"),
  "osu-collections": () => import("@content/guide/osu-collections.mdx"),
  "pack-key": () => import("@content/guide/pack-key.mdx"),
  "seed-a-torrent": () => import("@content/guide/seed-a-torrent.mdx"),
};

export const dynamicParams = false;

/**
 * @function generateStaticParams
 * @returns {Promise<object[]>} every path to prerender at build time
 */
export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

/**
 * @function generateMetadata
 * @param props {object} the route params
 * @returns {Promise<Metadata>} the page's title, description and links
 */
export async function generateMetadata({ params }: PageProps<"/guide/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isGuideSlug(slug)) return notFoundMetadata(SEO_SITE, "Guide");
  const { title, description, lastUpdated } = GUIDE_DOCS[slug];
  return pageMetadata(SEO_SITE, {
    path: `/guide/${slug}`,
    title,
    description,
    ogType: "article",
    modifiedTime: lastUpdated,
  });
}

/**
 * @function GuidePage
 * @param props {PageProps<"/guide/[slug]">} params
 * @returns {Promise<JSX.Element>} the page
 */
export default async function GuidePage({ params }: PageProps<"/guide/[slug]">) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) notFound();
  const { title, description, lastUpdated, howTo } = GUIDE_DOCS[slug];
  const { default: Content } = await LOADERS[slug]();

  return (
    <article>
      <PageHeader title={title} meta={`Last updated ${formatIsoDate(lastUpdated)}`} />
      <Prose className="mt-6">
        <Content />
      </Prose>
      <JsonLd
        data={ld.graph(
          ld.techArticle(SEO_SITE, {
            path: `/guide/${slug}`,
            headline: title,
            description,
            dateModified: lastUpdated,
          }),
          ...(howTo ? [ld.howTo({ name: title, description, steps: howTo })] : []),
          ld.breadcrumbs(SEO_SITE, [
            { name: "packs", path: "/" },
            { name: "Guides", path: "/guide" },
            { name: title, path: `/guide/${slug}` },
          ]),
        )}
      />
    </article>
  );
}
