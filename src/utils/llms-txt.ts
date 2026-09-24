/**
 * @file src/utils/llms-txt.ts
 * @desc /llms.txt (llmstxt.org): title, a one-paragraph summary, then link sections built from
 *       the page list and the guide, docs, and legal registries, so new docs appear on their own.
 *       Docs link their Markdown copy (/docs/<slug>.md), as llmstxt.org suggests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { OPENAPI_PATH } from "@/constants/api";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";
import { docMarkdownPath } from "@/utils/doc-markdown";

export type LlmsLink = { title: string; url: string; description?: string };
export type LlmsSection = { heading: string; links: LlmsLink[] };

const at = (path: string): string => `${SITE.url}${path}`;

/**
 * @function llmsSections
 * @returns {LlmsSection[]} Pages, Guides, Data, API, Legal (new arrays on every call)
 */
export const llmsSections = (): LlmsSection[] => [
  {
    heading: "Pages",
    links: [
      { title: "Home", url: at("/"), description: "Open a pack key, or start a new pack." },
      {
        title: "New pack",
        url: at("/new"),
        description:
          "Build an osu! mappool pack from beatmap IDs, links, or a pasted mappool, then download it as one zip or a torrent.",
      },
      {
        title: "Open a key",
        url: at("/k"),
        description: "Open an osu! mappool pack from a pack key.",
      },
      {
        title: "Public packs",
        url: at("/packs"),
        description: "Browse and search packs that hosts have shared publicly.",
      },
      {
        title: "Brand",
        url: at("/brand"),
        description:
          "The packs name, logos, colors, and type, for tournament staff, wikis, and press.",
      },
    ],
  },
  {
    heading: "Guides",
    links: GUIDE_SLUGS.map((slug) => ({
      title: GUIDE_DOCS[slug].title,
      url: at(`/guide/${slug}`),
      description: GUIDE_DOCS[slug].description,
    })),
  },
  {
    heading: "Data",
    links: [
      {
        title: "Public packs index",
        url: at("/packs/index.json"),
        description: `JSON { v: 1, packs: [{ s: slug, n: name, o: owner's osu! username, c: map count, d: description excerpt, u: last updated (ISO 8601), and once computed r: [min, max] star rating, a: average stars, l: [min, max] length in seconds, b: [min, max] BPM, m: mods (comma-separated), g: rulesets (comma-separated), k: stats complete }] }, newest first; a pack's page is ${at("/p/")}{s}.`,
      },
    ],
  },
  {
    heading: "API",
    links: [
      ...DOC_SLUGS.map((slug) => ({
        title: DOC_DOCS[slug].title,
        url: at(docMarkdownPath(slug)),
        description: DOC_DOCS[slug].description,
      })),
      {
        title: "OpenAPI document",
        url: at(OPENAPI_PATH),
        description: "OpenAPI 3.1 description of every /api/v1 endpoint.",
      },
    ],
  },
  {
    heading: "Legal",
    links: LEGAL_SLUGS.map((slug) => ({
      title: LEGAL_DOCS[slug].title,
      url: at(`/legal/${slug}`),
      description: LEGAL_DOCS[slug].description,
    })),
  },
];

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

const linkLine = ({ title, url, description }: LlmsLink): string =>
  `- [${oneLine(title)}](${url})${description ? `: ${oneLine(description)}` : ""}`;

/**
 * @function buildLlmsTxt
 * @param sections {LlmsSection[]} link sections (default: llmsSections())
 * @returns {string} the llms.txt body, ending in one newline
 */
export const buildLlmsTxt = (sections: LlmsSection[] = llmsSections()): string => {
  const lines = [
    `# ${SITE.title}`,
    "",
    `> ${oneLine(SITE.description)}`,
    ...sections.flatMap(({ heading, links }) => ["", `## ${heading}`, "", ...links.map(linkLine)]),
  ];
  return `${lines.join("\n")}\n`;
};
