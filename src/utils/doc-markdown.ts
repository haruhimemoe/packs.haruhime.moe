/**
 * @file src/utils/doc-markdown.ts
 * @desc Turns a doc's MDX source (plain Markdown, no JSX; tests/unit/content/docs-content.test.ts
 *       guards that) into the Markdown served at /docs/<slug>.md and copied by "Copy as Markdown":
 *       an H1 title when the file has none, site links made absolute so they work wherever the
 *       text is pasted, and one trailing newline.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { SITE } from "@/constants/site";

/** A Markdown link or image target that starts at the site root: `](/me)`, not `](//host)`. */
const ROOT_LINK = /\]\(\/(?!\/)/g;

/**
 * @function docMarkdownPath
 * @param slug {string} a registered doc slug
 * @returns {string} "/docs/<slug>.md"
 */
export const docMarkdownPath = (slug: string): string => `/docs/${slug}.md`;

/**
 * @function docMarkdown
 * @param title {string} the doc's registry title, used as the H1 when the source has none
 * @param source {string} the doc's MDX source (plain Markdown)
 * @param siteUrl {string} origin for root-relative links (default SITE.url)
 * @returns {string} Markdown with an H1, absolute site links, and exactly one trailing newline
 */
export const docMarkdown = (title: string, source: string, siteUrl: string = SITE.url): string => {
  const body = source.replace(/\r\n?/g, "\n").trim().replace(ROOT_LINK, `](${siteUrl}/`);
  // Title first or none: a "# " that isn't the very first line is someone else's content (a
  // fenced shell example, say), not this doc's own H1.
  const titled = /^# /.test(body) ? body : `# ${title}\n\n${body}`;
  return `${titled}\n`;
};
