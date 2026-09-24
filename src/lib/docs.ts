/**
 * @file src/lib/docs.ts
 * @desc Reads a doc's MDX source from content/docs at build time, for the Markdown copy of each
 *       doc (/docs/<slug>.md and the doc page's "Copy as Markdown" button).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DOC_DOCS, type DocSlug } from "@/constants/docs";
import { docMarkdown } from "@/utils/doc-markdown";

/**
 * @function docSourcePath
 * @param slug {DocSlug} a registered doc slug
 * @returns {string} the absolute path of content/docs/<slug>.mdx
 */
export const docSourcePath = (slug: DocSlug): string =>
  path.join(process.cwd(), "content", "docs", `${slug}.mdx`);

/**
 * @function readDocMarkdown
 * @param slug {DocSlug} a registered doc slug
 * @returns {Promise<string>} the doc as plain Markdown (see docMarkdown)
 * @throws {Error} when the MDX file is missing (a registry entry without a file)
 */
export const readDocMarkdown = async (slug: DocSlug): Promise<string> =>
  docMarkdown(DOC_DOCS[slug].title, await readFile(docSourcePath(slug), "utf8"));
