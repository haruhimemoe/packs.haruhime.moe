/**
 * @file tests/unit/app/docs-page.test.ts
 * @desc /docs/[slug] route guard, same contract as /guide/[slug].
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
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
      title: DOC_DOCS.api.title,
      description: DOC_DOCS.api.description,
      alternates: { canonical: "/docs/api" },
    });
  });
});
