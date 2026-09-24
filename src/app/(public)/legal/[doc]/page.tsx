/**
 * @file src/app/(public)/legal/[doc]/page.tsx
 * @desc Legal document route. Static params come from the registry; unknown slugs 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { MDXContent } from "mdx/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Prose } from "@/components/ui/Prose";
import { isLegalSlug, LEGAL_DOCS, LEGAL_SLUGS, type LegalSlug } from "@/constants/legal";
import { formatIsoDate } from "@/utils/date";

const LOADERS: Record<LegalSlug, () => Promise<{ default: MDXContent }>> = {
  terms: () => import("@content/legal/terms.mdx"),
  privacy: () => import("@content/legal/privacy.mdx"),
  "your-privacy-rights": () => import("@content/legal/your-privacy-rights.mdx"),
  copyright: () => import("@content/legal/copyright.mdx"),
  disclaimers: () => import("@content/legal/disclaimers.mdx"),
};

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  if (!isLegalSlug(doc)) return {};
  const { title, description } = LEGAL_DOCS[doc];
  return { title, description, alternates: { canonical: `/legal/${doc}` } };
}

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
