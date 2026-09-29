/**
 * @file tests/unit/app/docs-page.test.ts
 * @desc /docs/[slug] route guard, same contract as /guide/[slug].
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import DocsPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "@/app/(public)/docs/[slug]/page";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) }) as never;

describe("/docs/[slug]", () => {
  it("only renders registered slugs", () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(DOC_SLUGS.map((slug) => ({ slug })));
  });

  it.each(["__proto__", "nope"])("404s %j", async (slug) => {
    await expect(DocsPage(params(slug))).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/),
    });
  });

  it("uses the registry title and description, with a canonical URL", async () => {
    await expect(generateMetadata(params("api"))).resolves.toMatchObject({
      title: { absolute: `${DOC_DOCS.api.title} · packs.haruhime.moe` },
      description: DOC_DOCS.api.description,
      alternates: { canonical: "https://packs.haruhime.moe/docs/api" },
      openGraph: { url: "https://packs.haruhime.moe/docs/api", type: "article" },
    });
  });
});
