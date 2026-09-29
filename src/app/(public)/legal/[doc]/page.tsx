/**
 * @file src/app/(public)/legal/[doc]/page.tsx
 * @desc Legal document route. Static params come from the registry; unknown slugs 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { notFoundMetadata, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { MDXContent } from "mdx/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLegalSlug, LEGAL_DOCS, LEGAL_SLUGS, type LegalSlug } from "@/constants/legal";
import { SEO_SITE } from "@/constants/seo";
import { formatIsoDate } from "@/utils/date";

const LOADERS: Record<LegalSlug, () => Promise<{ default: MDXContent }>> = {
  terms: () => import("@content/legal/terms.mdx"),
  privacy: () => import("@content/legal/privacy.mdx"),
  "your-privacy-rights": () => import("@content/legal/your-privacy-rights.mdx"),
  copyright: () => import("@content/legal/copyright.mdx"),
  disclaimers: () => import("@content/legal/disclaimers.mdx"),
};

export const dynamicParams = false;

/**
 * @function generateStaticParams
 * @returns {Promise<object[]>} every path to prerender at build time
 */
export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

/**
 * @function generateMetadata
 * @param props {object} the route params
 * @returns {Promise<Metadata>} the page's title, description and links
 */
export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  if (!isLegalSlug(doc)) return notFoundMetadata(SEO_SITE, "Page");
  const { title, description, lastUpdated } = LEGAL_DOCS[doc];
  return pageMetadata(SEO_SITE, {
    path: `/legal/${doc}`,
    title: `packs ${title}`,
    description,
    ogType: "article",
    modifiedTime: lastUpdated,
  });
}

/**
 * @function LegalPage
 * @param props {PageProps<"/legal/[doc]">} params
 * @returns {Promise<JSX.Element>} the page
 */
export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  if (!isLegalSlug(doc)) notFound();
  const { title, lastUpdated } = LEGAL_DOCS[doc];
  const { default: Content } = await LOADERS[doc]();

  return (
    <article>
      <PageHeader title={title} meta={`Last updated ${formatIsoDate(lastUpdated)}`} />
      <Prose className="mt-6">
        <Content />
      </Prose>
    </article>
  );
}
