/**
 * @file tests/unit/app/guide-page.test.ts
 * @desc /guide/[slug] route guard, same contract as /legal/[doc].
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import GuidePage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "@/app/(public)/guide/[slug]/page";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) }) as never;

describe("/guide/[slug]", () => {
  it("only renders registered slugs", () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(GUIDE_SLUGS.map((slug) => ({ slug })));
  });

  it.each(["__proto__", "nope"])("404s %j", async (slug) => {
    await expect(GuidePage(params(slug))).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/),
    });
  });

  it("uses the registry title and description", async () => {
    await expect(generateMetadata(params("pack-key"))).resolves.toMatchObject({
      title: GUIDE_DOCS["pack-key"].title,
      description: GUIDE_DOCS["pack-key"].description,
    });
  });

  it("gives each guide a canonical URL", async () => {
    await expect(generateMetadata(params("make-a-pack"))).resolves.toMatchObject({
      alternates: { canonical: "/guide/make-a-pack" },
    });
  });
});
