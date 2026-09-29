/**
 * @file src/lib/docs.ts
 * @desc Reads a doc's or a guide's MDX source (plain Markdown) at build time: the Markdown copy
 *       of each doc (/docs/<slug>.md and the doc page's "Copy as Markdown" button), and the
 *       guides and docs /llms-full.txt joins into one file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DOC_DOCS, type DocSlug } from "@/constants/docs";
import { GUIDE_DOCS, type GuideSlug } from "@/constants/guide";
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

/**
 * @function readGuideMarkdown
 * @param slug {GuideSlug} a registered guide slug
 * @returns {Promise<string>} the guide as plain Markdown, titled and with absolute site links
 * @throws {Error} when the MDX file is missing (a registry entry without a file)
 */
export const readGuideMarkdown = async (slug: GuideSlug): Promise<string> =>
  docMarkdown(
    GUIDE_DOCS[slug].title,
    await readFile(path.join(process.cwd(), "content", "guide", `${slug}.mdx`), "utf8"),
  );
