/**
 * @file tests/unit/app/docs-markdown-route.test.ts
 * @desc /docs/<slug>.md: the rewrite to the Markdown route, static params from the registry,
 *       text/markdown with the doc's Markdown, 404 for anything else.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  dynamic,
  dynamicParams,
  GET,
  generateStaticParams,
} from "@/app/(public)/docs/[slug]/md/route";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { docMarkdown } from "@/utils/doc-markdown";
import nextConfig from "../../../next.config";

const call = (slug: string) =>
  GET(new Request(`https://packs.haruhime.moe/docs/${slug}.md`), {
    params: Promise.resolve({ slug }),
  });

describe("/docs/<slug>.md", () => {
  it("is rewritten from the .md URL to the route", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toContainEqual({
      source: "/docs/:slug([a-z0-9-]+).md",
      destination: "/docs/:slug/md",
    });
  });

  it("is static and only serves registered slugs", () => {
    expect(dynamic).toBe("force-static");
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(DOC_SLUGS.map((slug) => ({ slug })));
  });

  it.each(DOC_SLUGS)("serves %s as UTF-8 Markdown with its title as the H1", async (slug) => {
    const response = await call(slug);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const source = readFileSync(path.join(process.cwd(), "content", "docs", `${slug}.mdx`), "utf8");
    const body = await response.text();
    expect(body).toBe(docMarkdown(DOC_DOCS[slug].title, source));
    expect(body.startsWith(`# ${DOC_DOCS[slug].title}\n\n`)).toBe(true);
  });

  it.each(["__proto__", "nope"])("404s %j", async (slug) => {
    expect((await call(slug)).status).toBe(404);
  });
});
