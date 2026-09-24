/**
 * @file tests/unit/app/legal-page.test.ts
 * @desc Route-level guard for /legal/[doc]: static params match the registry, unknown slugs are
 *       never rendered on demand, and the page 404s (not 500s) on a bad slug.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import LegalPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "@/app/(public)/legal/[doc]/page";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";

const params = (doc: string) => ({ params: Promise.resolve({ doc }) }) as never;

describe("/legal/[doc]", () => {
  it("never renders slugs outside the static params", () => {
    expect(dynamicParams).toBe(false);
  });

  it("statically generates exactly the registered slugs", () => {
    expect(generateStaticParams()).toEqual(LEGAL_SLUGS.map((doc) => ({ doc })));
  });

  it.each(["__proto__", "constructor", "Terms", "nope"])(
    "throws Next's 404 for %j instead of crashing",
    async (doc) => {
      await expect(LegalPage(params(doc))).rejects.toMatchObject({
        digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/),
      });
    },
  );

  it("titles each page from the registry", async () => {
    for (const slug of LEGAL_SLUGS) {
      await expect(generateMetadata(params(slug))).resolves.toMatchObject({
        title: LEGAL_DOCS[slug].title,
      });
    }
  });

  it("gives each page a description and a canonical URL", async () => {
    for (const slug of LEGAL_SLUGS) {
      await expect(generateMetadata(params(slug))).resolves.toMatchObject({
        description: LEGAL_DOCS[slug].description,
        alternates: { canonical: `/legal/${slug}` },
      });
    }
  });
});
