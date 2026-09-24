/**
 * @file tests/unit/utils/llms-txt.test.ts
 * @desc llms.txt follows the llmstxt.org shape, is built from the registries (every guide and
 *       legal doc appears, docs by their .md copy), and every link is absolute and on one line.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";
import { buildLlmsTxt, llmsSections } from "@/utils/llms-txt";

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt();

  it("opens with the site title and the description as a quote", () => {
    expect(text.startsWith(`# ${SITE.title}\n\n> ${SITE.description}\n`)).toBe(true);
  });

  it("has the Pages, Guides, Data, API, and Legal sections in that order", () => {
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(["Pages", "Guides", "Data", "API", "Legal"]);
  });

  it("lists the main pages", () => {
    for (const path of ["/", "/new", "/k", "/packs", "/brand"]) {
      expect(text).toContain(`](${SITE.url}${path})`);
    }
  });

  it.each(GUIDE_SLUGS)("lists the %s guide with its title and description", (slug) => {
    const { title, description } = GUIDE_DOCS[slug];
    expect(text).toContain(`- [${title}](${SITE.url}/guide/${slug}): ${description}`);
  });

  it.each(DOC_SLUGS)("lists the %s doc by its Markdown copy", (slug) => {
    const { title, description } = DOC_DOCS[slug];
    expect(text).toContain(`- [${title}](${SITE.url}/docs/${slug}.md): ${description}`);
  });

  it.each(LEGAL_SLUGS)("lists the %s legal doc", (slug) => {
    expect(text).toContain(`- [${LEGAL_DOCS[slug].title}](${SITE.url}/legal/${slug})`);
  });

  it("describes the public packs index, stats included", () => {
    expect(text).toContain(`](${SITE.url}/packs/index.json): `);
    expect(text).toContain("r: [min, max] star rating");
    expect(text).toContain("k: stats complete");
  });

  it("uses absolute links on our own site only", () => {
    const urls = [...text.matchAll(LINK)].map((m) => m[2] ?? "");
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) expect(new URL(url).origin).toBe(SITE.url);
  });

  it("ends with exactly one newline", () => {
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  it("renders given sections, with no colon when a link has no description", () => {
    expect(
      buildLlmsTxt([{ heading: "API", links: [{ title: "Docs", url: "https://example.com/d" }] }]),
    ).toBe(
      `# ${SITE.title}\n\n> ${SITE.description}\n\n## API\n\n- [Docs](https://example.com/d)\n`,
    );
  });

  it("keeps every link on one line, whatever whitespace a registry entry has", () => {
    const out = buildLlmsTxt([
      {
        heading: "X",
        links: [
          { title: " Two\nlines ", url: "https://example.com/x", description: "a\n\n b\tc " },
        ],
      },
    ]);
    expect(out).toContain("\n- [Two lines](https://example.com/x): a b c\n");
  });
});

describe("llmsSections", () => {
  it("returns fresh arrays each call, so a caller can't change the next build", () => {
    const first = llmsSections();
    first[0]?.links.push({ title: "Injected", url: "https://example.com/i" });
    expect(buildLlmsTxt()).not.toContain("Injected");
  });
});
