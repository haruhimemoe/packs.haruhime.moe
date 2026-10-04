/**
 * @file tests/unit/app/legal-page.test.ts
 * @desc Route-level guard for /legal/[slug]: static params match the registry, unknown slugs are
 *       never rendered on demand, and the page 404s (not 500s) on a bad slug.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { describe, expect, it } from "vitest";
import LegalPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "@/app/(public)/legal/[slug]/page";
import { CONTENT } from "@/constants/content";

const LEGAL = CONTENT.entries.legal;

const params = (slug: string) => ({ params: Promise.resolve({ slug }) }) as never;

describe("/legal/[slug]", () => {
  it("never renders slugs outside the static params", () => {
    expect(dynamicParams).toBe(false);
  });

  it("statically generates exactly the registered slugs", () => {
    expect(generateStaticParams()).toEqual(LEGAL.map(({ slug }) => ({ slug })));
  });

  it.each(["__proto__", "constructor", "Terms", "nope"])(
    "throws Next's 404 for %j instead of crashing",
    async (slug) => {
      await expect(LegalPage(params(slug))).rejects.toMatchObject({
        digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/),
      });
    },
  );

  it("titles each page from the registry", async () => {
    for (const { slug, title } of LEGAL) {
      await expect(generateMetadata(params(slug))).resolves.toMatchObject({
        title: { absolute: `packs ${title} · packs.haruhime.moe` },
      });
    }
  });

  it("titles the rights page for the laws it covers", () => {
    expect(LEGAL.find((e) => e.slug === "your-privacy-rights")?.title).toBe("GDPR & CCPA");
  });

  it("gives each page a description and a canonical URL", async () => {
    for (const { slug, description } of LEGAL) {
      await expect(generateMetadata(params(slug))).resolves.toMatchObject({
        description,
        alternates: { canonical: `https://packs.haruhime.moe/legal/${slug}` },
      });
    }
  });
});
