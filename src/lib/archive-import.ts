/**
 * @file src/lib/archive-import.ts
 * @desc The `bun run archive:import otdb [--dry-run] [--file <path>]` runner
 *       (scripts/archive-import.ts), run by an admin with the production database environment.
 *       It downloads otdb's export (or reads --file), plans against the stored archive packs,
 *       prints a summary, and writes only without --dry-run. After a real import that changed
 *       something it asks the live site to refresh /packs and its index
 *       (POST /api/cron/revalidate-packs with CRON_SECRET); without CRON_SECRET, or if that
 *       request fails, it says so, and the pages refresh on their own within 5 minutes. Answers
 *       an exit code: 0 done, 1 a fatal error (download, a bad file or export, the database), 2
 *       bad arguments. Every outside call is injectable, so tests never reach otdb or the site.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { readFile } from "node:fs/promises";
import { OTDB_EXPORT_URL } from "@/constants/archive";
import { SERVER_USER_AGENT, SITE } from "@/constants/site";
import { getCronSecret } from "@/env";
import { importArchive } from "@/services/archive";
import { formatImportReport, IMPORT_USAGE, parseImportArgs } from "@/utils/archive-import";
import { normalizePools } from "@/utils/archive-pools";
import { readOtdbExport } from "@/utils/otdb";

/** Where the importer asks the site to refresh /packs. */
export const REVALIDATE_PACKS_PATH = "/api/cron/revalidate-packs";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type ArchiveImportDeps = {
  fetch?: Fetch;
  readFile?: (path: string) => Promise<string>;
  log?: (text: string) => void;
  warn?: (text: string) => void;
  now?: () => Date;
  makeSlug?: () => string;
  /** The site to refresh (default: production). */
  siteUrl?: string;
  /** CRON_SECRET (default: from the environment, checked by getCronSecret). */
  cronSecret?: () => string | undefined;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * @function downloadOtdbExport
 * @param doFetch {Fetch} fetch (tests)
 * @returns {Promise<unknown>} the export, parsed as JSON
 * @throws {Error} when the download fails or isn't JSON
 */
export const downloadOtdbExport = async (doFetch: Fetch = globalThis.fetch): Promise<unknown> => {
  const response = await doFetch(OTDB_EXPORT_URL, {
    headers: { Accept: "application/json", "User-Agent": SERVER_USER_AGENT },
  });
  if (!response.ok) throw new Error(`Downloading the otdb export failed (${response.status}).`);
  return response.json();
};

/** Asks the site to refresh /packs; says what happened and never throws. */
const refreshSite = async ({
  doFetch,
  siteUrl,
  cronSecret,
  log,
  warn,
}: {
  doFetch: Fetch;
  siteUrl: string;
  cronSecret: () => string | undefined;
  log: (text: string) => void;
  warn: (text: string) => void;
}): Promise<void> => {
  const later = "/packs refreshes on its own within 5 minutes.";
  let secret: string | undefined;
  try {
    secret = cronSecret();
  } catch (error) {
    warn(`${messageOf(error)} ${later}`);
    return;
  }
  if (!secret) {
    log(`CRON_SECRET isn't set, so ${siteUrl} wasn't asked to refresh. ${later}`);
    return;
  }
  try {
    const response = await doFetch(`${siteUrl}${REVALIDATE_PACKS_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "User-Agent": SERVER_USER_AGENT },
    });
    if (!response.ok) throw new Error(`the site answered ${response.status}`);
    log(`Refreshed /packs and its index on ${siteUrl}.`);
  } catch (error) {
    warn(`Couldn't refresh /packs on ${siteUrl}: ${messageOf(error)}. ${later}`);
  }
};

/**
 * @function runArchiveImport
 * @param argv {readonly string[]} the arguments after the script name
 * @param deps {ArchiveImportDeps} outside calls and clock (tests)
 * @returns {Promise<number>} the exit code: 0 done (skipped pools included), 1 a fatal error, 2
 *          bad arguments
 */
export const runArchiveImport = async (
  argv: readonly string[],
  {
    fetch: doFetch = globalThis.fetch,
    readFile: read = (path) => readFile(path, "utf8"),
    log = console.log,
    warn = console.error,
    now = () => new Date(),
    makeSlug,
    siteUrl = SITE.url,
    cronSecret = getCronSecret,
  }: ArchiveImportDeps = {},
): Promise<number> => {
  const parsed = parseImportArgs(argv);
  if (!parsed.ok) {
    warn(parsed.error);
    warn(IMPORT_USAGE);
    return 2;
  }
  const { source, dryRun, file } = parsed.args;
  let written = 0;
  try {
    const raw: unknown =
      file === null ? await downloadOtdbExport(doFetch) : JSON.parse(await read(file));
    const exported = readOtdbExport(raw);
    const at = now();
    const normalized = normalizePools(exported.pools, exported.meta, at);
    const result = await importArchive(
      normalized.pools,
      [...exported.skipped, ...normalized.skipped],
      { dryRun, now: at, ...(makeSlug ? { makeSlug } : {}) },
    );
    const listed = exported.pools.length + exported.skipped.length;
    log(formatImportReport(result.plan, { read: listed, dryRun, source }));
    if (!dryRun) {
      log(`\nWrote ${result.created} new packs and new sources on ${result.updated} packs.`);
    }
    written = result.created + result.updated;
  } catch (error) {
    warn(`archive:import stopped: ${messageOf(error)}`);
    return 1;
  }
  if (written > 0) await refreshSite({ doFetch, siteUrl, cronSecret, log, warn });
  return 0;
};
