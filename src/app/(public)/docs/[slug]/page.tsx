/**
 * @file src/app/(public)/docs/[slug]/page.tsx
 * @desc Developer docs route (the API docs). Static params from the registry; unknown slugs 404.
 *       The header carries "Copy as Markdown" with the doc's Markdown, read at build time.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import type { MDXContent } from "mdx/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyMarkdownButton } from "@/components/docs/CopyMarkdownButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Prose } from "@/components/ui/Prose";
import { DOC_DOCS, DOC_SLUGS, type DocSlug, isDocSlug } from "@/constants/docs";
import { readDocMarkdown } from "@/lib/docs";
import { formatIsoDate } from "@/utils/date";
import { docMarkdownPath } from "@/utils/doc-markdown";

const LOADERS: Record<DocSlug, () => Promise<{ default: MDXContent }>> = {
  api: () => import("@content/docs/api.mdx"),
};

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isDocSlug(slug)) return {};
  const { title, description } = DOC_DOCS[slug];
  return { title, description, alternates: { canonical: `/docs/${slug}` } };
}

export default async function DocsPage({ params }: PageProps<"/docs/[slug]">) {
  const { slug } = await params;
  if (!isDocSlug(slug)) notFound();
  const { title, lastUpdated } = DOC_DOCS[slug];
  const [{ default: Content }, markdown] = await Promise.all([
    LOADERS[slug](),
    readDocMarkdown(slug),
  ]);

  return (
    <article>
      <PageHeader
        title={title}
        meta={`Last updated ${formatIsoDate(lastUpdated)}`}
        actions={<CopyMarkdownButton markdown={markdown} href={docMarkdownPath(slug)} />}
      />
      <Prose className="mt-6">
        <Content />
      </Prose>
    </article>
  );
}
