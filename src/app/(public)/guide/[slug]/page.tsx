/**
 * @file src/app/(public)/guide/[slug]/page.tsx
 * @desc Guide document route. Static params from the registry; unknown slugs 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { JsonLd, PageHeader, Prose } from "@haruhimemoe/ui";
import type { MDXContent } from "mdx/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDE_DOCS, GUIDE_SLUGS, type GuideSlug, isGuideSlug } from "@/constants/guide";
import { formatIsoDate } from "@/utils/date";

const LOADERS: Record<GuideSlug, () => Promise<{ default: MDXContent }>> = {
  "download-a-torrent": () => import("@content/guide/download-a-torrent.mdx"),
  "make-a-pack": () => import("@content/guide/make-a-pack.mdx"),
  "pack-key": () => import("@content/guide/pack-key.mdx"),
  "seed-a-torrent": () => import("@content/guide/seed-a-torrent.mdx"),
};

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/guide/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isGuideSlug(slug)) return {};
  const { title, description } = GUIDE_DOCS[slug];
  return { title, description, alternates: { canonical: `/guide/${slug}` } };
}

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
      {howTo ? (
        <JsonLd
          data={{
            "@type": "HowTo",
            name: title,
            description,
            step: howTo.map((step, i) => ({
              "@type": "HowToStep",
              position: i + 1,
              name: step.name,
              text: step.text,
            })),
          }}
        />
      ) : null}
    </article>
  );
}
