/**
 * @file src/utils/llms-txt.ts
 * @desc /llms.txt (llmstxt.org) through next-kit's contentLlmsTxt: title, summary, a few facts
 *       a reader needs first (no file hosting, pack keys, the haruhime pools account and that
 *       pools is in beta, the osu! collection card, the pages and the other haruhime tools),
 *       then Docs, Guides, API and Legal. Docs, guides and legal come from the content registry
 *       and link their .md mirrors, so a new page appears on its own. API links the OpenAPI
 *       document and the search index (the read that needs no key), from the same constants the
 *       code uses.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { type ContentApiLink, contentLlmsTxt } from "@haruhimemoe/next-kit/docs";
import { RULESETS } from "@haruhimemoe/pool";
import { OPENAPI_PATH } from "@/constants/api";
import { CONTENT } from "@/constants/content";
import { DESCRIPTION_EXCERPT_LENGTH } from "@/constants/pack";
import { PACK_SORTS } from "@/constants/pack-filters";
import { STAT_MOD_CODES } from "@/constants/pack-stats";
import { SEARCH_INDEX_LIMIT } from "@/constants/public-packs";
import { BB_URL, POOLS_URL, SEO_SITE } from "@/constants/seo";
import { SITE } from "@/constants/site";

const at = (path: string): string => `${SITE.url}${path}`;

/** Where every docs, guides and legal page is served as one Markdown file. */
export const LLMS_FULL_PATH = "/llms-full.txt";

const list = (values: readonly string[]): string => values.join(", ");

/** How /packs filters live in its query string. */
const PUBLIC_PACKS_NOTE = `Filters live in the query string: q (search text), sr (star rating range, like 5.5-6.5 or 6+), len (length in seconds), bpm, maps (map count), mods (comma-separated from ${STAT_MOD_CODES.join(",")}; a pack needs all of them), mode (comma-separated from ${RULESETS.join(",")}; a pack needs all of them), sort (${list(PACK_SORTS)}; new by default).`;

/** What a reader should know before following any link. Plain text, one paragraph each. */
export const LLMS_NOTES: readonly string[] = [
  "packs doesn't host beatmap files. The browser downloads each .osz from the beatmap mirror (mirror.hinamizawa.ai) and builds the zip and the torrent itself.",
  `A pack key (pk1., pk2. or pk3.) holds a whole pool in one line of text and opens at ${at("/k#")} followed by the key, with no account. Signed in with osu!, a host can also save a pack and get a short link, ${at("/p/")}{slug}.`,
  "Packs owned by haruhime pools are osu! tournament mappools published from pools.haruhime.moe (in beta), haruhime's mappool builder: hosts build pools there, and it also gets pools from tournament hosts, community submissions and other sources, and each pool's page there credits its sources.",
  "\"Add to osu! collection\" puts the pack's maps in one of the player's osu! collections. It's on every pack page (/new, /k and /p/{slug}). osu!stable players load their collection.db and download it back with the maps added; osu!lazer players download a zip that lazer's setup wizard imports. The browser reads the file; it never reaches the server.",
  `Pages: ${at("/new")} builds a pack from beatmap IDs, links or a pasted mappool and downloads it as one zip or a torrent; ${at("/k")} opens a pack key; ${at("/brand")} has the name, logos, colors and type. ${at("/packs")} lists the packs hosts shared publicly. ${PUBLIC_PACKS_NOTE}`,
  `Elsewhere: pools (${POOLS_URL}) is haruhime's osu! tournament mappool builder, where the haruhime pools account's packs come from; bb (${BB_URL}) is haruhime's osu! BBCode editor; our Discord server is ${SITE.discordUrl}.`,
];

/**
 * @function llmsApiLinks
 * @returns {ContentApiLink[]} the API section: the OpenAPI document, the search index and
 *          every page in one file (new arrays on every call)
 */
export const llmsApiLinks = (): ContentApiLink[] => [
  {
    title: "OpenAPI",
    url: at(OPENAPI_PATH),
    note: "OpenAPI 3.1 description of every /api/v1 endpoint.",
  },
  {
    title: "Public packs index",
    url: at("/packs/index.json"),
    note: `JSON { v: 1, packs: [{ s: slug, n: name, o: owner's osu! username, c: map count, d: description excerpt (up to ${DESCRIPTION_EXCERPT_LENGTH} characters, plus … when cut), u: last updated (ISO 8601), t: created (ISO 8601), and once computed r: [min, max] star rating, a: average stars, l: [min, max] length in seconds, b: [min, max] BPM, m: mods (comma-separated), g: rulesets (comma-separated), k: stats complete }] }. Up to ${SEARCH_INDEX_LIMIT.toLocaleString("en-US")} packs, newest created first. No key needed. A pack's page is ${at("/p/")}{s}.`,
  },
  {
    title: "Every page in one file",
    url: at(LLMS_FULL_PATH),
    note: "The docs, guides and legal pages as one Markdown file.",
  },
];

/**
 * @function buildLlmsTxt
 * @returns {string} the llms.txt body: title, summary, LLMS_NOTES, then Docs, Guides, API and
 *          Legal, ending in one newline
 */
export const buildLlmsTxt = (): string =>
  contentLlmsTxt({
    site: SEO_SITE,
    title: SITE.title,
    summary: SITE.description,
    notes: LLMS_NOTES,
    content: CONTENT,
    api: llmsApiLinks(),
  });
