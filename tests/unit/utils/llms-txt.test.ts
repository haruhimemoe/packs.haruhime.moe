/**
 * @file tests/unit/utils/llms-txt.test.ts
 * @desc llms.txt follows the llmstxt.org shape, opens with the notes a reader needs first (no
 *       file hosting, pack keys, the haruhime pools account and that pools is in beta, the osu!
 *       collection card), is built from the registries (every guide and legal doc appears, docs
 *       by their .md copy), names osu! collections among the guides, spells out the /packs query
 *       string and the index keys, ends with pools, bb and our Discord server under Elsewhere,
 *       links /llms-full.txt, and every link is absolute.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";
import { buildLlmsTxt, LLMS_NOTES, llmsSections } from "@/utils/llms-txt";

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

  it("notes the osu! collection card and names it among the guides", () => {
    expect(text).toContain(
      "\"Add to osu! collection\" puts the pack's maps in one of the player's osu! collections.",
    );
    expect(text).toContain("The browser reads the file; it never reaches the server.");
    const guides = text.split("\n").find((line) => line.startsWith("- [Guides]")) ?? "";
    expect(guides).toContain("osu! collections");
  });

  it("doesn't call every pools pack a past pool", () => {
    expect(LLMS_NOTES.join(" ")).not.toMatch(/past (osu! )?tournament/i);
  });

  it("has no note about archived pools", () => {
    expect(LLMS_NOTES.join(" ")).not.toMatch(/archive/i);
  });

  it("has the Pages, Guides, Data, API, Legal, and Elsewhere sections in that order", () => {
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(["Pages", "Guides", "Data", "API", "Legal", "Elsewhere"]);
  });

  it("ends with pools, bb and our Discord server under Elsewhere", () => {
    const elsewhere = text.slice(text.indexOf("\n## Elsewhere\n"));
    expect(elsewhere).toContain("- [pools](https://pools.haruhime.moe): ");
    expect(elsewhere).toContain("- [bb](https://bb.haruhime.moe): ");
    expect(
      text.endsWith("- [Discord](https://discord.gg/bKy9kjMV4y): our public Discord server\n"),
    ).toBe(true);
  });

  it("links the one-file copy of the guides", () => {
    expect(text).toContain(`](${SITE.url}/llms-full.txt): `);
  });

  it("lists the main pages", () => {
    for (const path of ["/", "/new", "/k", "/packs", "/guide", "/brand"]) {
      expect(text).toContain(`](${SITE.url}${path})`);
    }
  });

  it.each(GUIDE_SLUGS)("lists the %s guide with its title and description", (slug) => {
    const { title, description } = GUIDE_DOCS[slug];
    expect(text).toContain(`- [${title}](${SITE.url}/guide/${slug}): ${description}`);
  });

  it("mentions no archived pools or otdb anywhere", () => {
    expect(text).not.toMatch(/archived|otdb/i);
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
    expect(text).toContain("t: created (ISO 8601)");
    expect(text).toContain("newest created first");
    expect(text).toContain("r: [min, max] star rating");
    expect(text).toContain("k: stats complete");
    expect(text).toContain("characters, plus … when cut)");
    expect(text).toContain("packs, newest created first. No key needed.");
    expect(text).not.toMatch(/\bxk\b|\bxu\b|x: 1/);
  });

  it("spells out the /packs query string", () => {
    const line = text.split("\n").find((l) => l.startsWith("- [Public packs]")) ?? "";
    for (const param of ["q (", "sr (", "len (", "bpm", "maps (", "mods (", "mode (", "sort ("]) {
      expect(line).toContain(param);
    }
    expect(line).not.toContain("source");
    expect(line).toContain("new, updated, sr-asc, sr-desc, maps, name");
  });

  it("has no map usage entry", () => {
    expect(text).not.toMatch(/map usage|\/beatmaps\//i);
  });

  it("uses absolute links on our own site, except the sibling tools and Discord under Elsewhere", () => {
    const [ours = "", elsewhere = ""] = text.split("\n## Elsewhere\n");
    const urls = [...ours.matchAll(LINK)].map((m) => m[2] ?? "");
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) expect(new URL(url).origin).toBe(SITE.url);
    expect([...elsewhere.matchAll(LINK)].map((m) => m[2])).toEqual([
      "https://pools.haruhime.moe",
      "https://bb.haruhime.moe",
      SITE.discordUrl,
    ]);
  });

  it("ends with exactly one newline", () => {
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });
});

describe("llmsSections", () => {
  it("returns fresh arrays each call, so a caller can't change the next build", () => {
    const first = llmsSections();
    (first[0]?.links as { title: string; url: string }[] | undefined)?.push({
      title: "Injected",
      url: "https://example.com/i",
    });
    expect(buildLlmsTxt()).not.toContain("Injected");
  });
});
