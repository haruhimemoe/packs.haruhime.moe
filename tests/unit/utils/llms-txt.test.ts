/**
 * @file tests/unit/utils/llms-txt.test.ts
 * @desc llms.txt follows the llmstxt.org shape, opens with the notes a reader needs first (no
 *       file hosting, pack keys, the haruhime pools account and that pools is in beta, the osu!
 *       collection card, the pages with the /packs query string, pools, bb and our Discord
 *       server), then Docs, Guides, API and Legal from the content registry (every page by its
 *       .md mirror), the API section with the OpenAPI document, the index keys and
 *       /llms-full.txt, and every link is absolute.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { describe, expect, it } from "vitest";
import { OPENAPI_PATH } from "@/constants/api";
import { CONTENT } from "@/constants/content";
import { SITE } from "@/constants/site";
import { buildLlmsTxt, LLMS_NOTES, llmsApiLinks } from "@/utils/llms-txt";

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt();

  it("opens with the site title and the description as a quote", () => {
    expect(text.startsWith(`# ${SITE.title}\n\n> ${SITE.description}\n`)).toBe(true);
  });

  it("puts the notes between the quote and the first section, one paragraph each", () => {
    const head = text.slice(0, text.indexOf("\n\n## "));
    expect(head).toBe([`# ${SITE.title}`, `> ${SITE.description}`, ...LLMS_NOTES].join("\n\n"));
  });

  it.each([
    "packs doesn't host beatmap files.",
    `opens at ${SITE.url}/k# followed by the key, with no account.`,
    "Packs owned by haruhime pools are osu! tournament mappools published from pools.haruhime.moe",
    "pools.haruhime.moe (in beta)",
    "from tournament hosts, community submissions and other sources",
    "each pool's page there credits its sources.",
  ])("notes %j", (phrase) => {
    expect(text).toContain(phrase);
  });

  it("notes the osu! collection card and lists its guide", () => {
    expect(text).toContain(
      "\"Add to osu! collection\" puts the pack's maps in one of the player's osu! collections.",
    );
    expect(text).toContain("The browser reads the file; it never reaches the server.");
    expect(text).toContain(`](${SITE.url}/guides/osu-collections.md): `);
  });

  it("doesn't call every pools pack a past pool", () => {
    expect(LLMS_NOTES.join(" ")).not.toMatch(/past (osu! )?tournament/i);
  });

  it("has no note about archived pools", () => {
    expect(LLMS_NOTES.join(" ")).not.toMatch(/archive/i);
  });

  it("has the Docs, Guides, API and Legal sections in that order", () => {
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(["Docs", "Guides", "API", "Legal"]);
  });

  it("names pools, bb and our Discord server, and the main pages", () => {
    for (const url of ["https://pools.haruhime.moe", "https://bb.haruhime.moe", SITE.discordUrl])
      expect(text).toContain(url);
    for (const path of ["/new", "/k", "/packs", "/brand"])
      expect(text).toContain(`${SITE.url}${path}`);
  });

  it.each(
    CONTENT.sections.flatMap((section) =>
      CONTENT.entries[section].map((e) => [section, e.slug, e] as const),
    ),
  )("lists %s/%s by its Markdown mirror", (section, slug, { title, description }) => {
    expect(text).toContain(`- [${title}](${SITE.url}/${section}/${slug}.md): ${description}`);
  });

  it("links the OpenAPI document and the one-file copy under API, before Legal", () => {
    const api = text.slice(text.indexOf("\n## API\n"), text.indexOf("\n## Legal\n"));
    expect(api).toContain(`- [OpenAPI](${SITE.url}${OPENAPI_PATH}): `);
    expect(api).toContain(`](${SITE.url}/llms-full.txt): `);
  });

  it("mentions no archived pools or otdb anywhere", () => {
    expect(text).not.toMatch(/archived|otdb/i);
  });

  it("describes the public packs index, stats included", () => {
    expect(text).toContain(`](${SITE.url}/packs/index.json): `);
    expect(text).toContain("t: created (ISO 8601)");
    expect(text).toContain("newest created first");
    expect(text).toContain("r: [min, max] star rating");
    expect(text).toContain("k: stats complete");
    expect(text).toContain("characters, plus … when cut)");
    expect(text).toContain("packs, newest created first. No key needed.");
    expect(text).not.toMatch(/\bxk\b|\bxu\b|x: 1/);
  });

  it("spells out the /packs query string", () => {
    const line = LLMS_NOTES.find((l) => l.startsWith("Pages: ")) ?? "";
    for (const param of ["q (", "sr (", "len (", "bpm", "maps (", "mods (", "mode (", "sort ("]) {
      expect(line).toContain(param);
    }
    expect(line).not.toContain("source");
    expect(line).toContain("new, updated, sr-asc, sr-desc, maps, name");
  });

  it("has no map usage entry", () => {
    expect(text).not.toMatch(/map usage|\/beatmaps\//i);
  });

  it("links only absolute URLs on our own site", () => {
    const urls = [...text.matchAll(LINK)].map((m) => m[2] ?? "");
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) expect(new URL(url).origin).toBe(SITE.url);
  });

  it("ends with exactly one newline", () => {
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });
});

describe("llmsApiLinks", () => {
  it("returns a fresh array each call, so a caller can't change the next build", () => {
    llmsApiLinks().push({ title: "Injected", url: "https://example.com/i" });
    expect(buildLlmsTxt()).not.toContain("Injected");
  });
});
