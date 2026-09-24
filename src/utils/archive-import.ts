/**
 * @file src/utils/archive-import.ts
 * @desc Planning an archive import (pool archive spec): normalized pools against the archive
 *       packs already stored. A pool's identity is its fingerprint: a new fingerprint is a new
 *       pack; a stored one gains the source if it doesn't have it yet, and is unchanged if it
 *       does; the same pool twice in one import is one new pack with both sources. A source
 *       whose pool changed (a new fingerprint for a source id a stored pack already has) gets its
 *       own pack, the old one stays, and the plan flags the pair. Also the runner's arguments and
 *       the summary it prints, where every piece of source text (names, labels in reasons) has
 *       its control characters replaced and is cut short, so an export can't drive the admin's
 *       terminal. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ARCHIVE_SOURCE_LABELS, type ArchiveSourceKind } from "@/constants/archive";
import type { ArchiveSourceRef, NormalizedPool, SkippedPool } from "@/utils/archive-pools";

/** An archive pack already stored, as planning needs it. */
export type ExistingArchivePack = {
  slug: string;
  name: string;
  fingerprint: string;
  sources: readonly { kind: string; id: string }[];
};

/** A pack to create: the first source's pool, and every source it came from in this import. */
export type PlannedCreate = { pool: NormalizedPool; sources: ArchiveSourceRef[] };
/** Sources to add to a stored pack. */
export type PlannedUpdate = { slug: string; name: string; sources: ArchiveSourceRef[] };
/** A source a stored pack already has. */
export type UnchangedPool = { slug: string; name: string; source: ArchiveSourceRef };
/** A pool seen twice in this import: `source` joins the pack planned for `into`. */
export type MergedPool = { source: ArchiveSourceRef; into: ArchiveSourceRef; name: string };
/** A source whose pool changed: its old pack stays, and it now belongs to another pack. */
export type ChangedPool = {
  source: ArchiveSourceRef;
  from: { slug: string; name: string };
  /** The pack it goes to: a stored one, or null for one this import creates. */
  to: { slug: string | null; name: string };
};

export type ArchivePlan = {
  create: PlannedCreate[];
  update: PlannedUpdate[];
  unchanged: UnchangedPool[];
  merged: MergedPool[];
  changed: ChangedPool[];
  skipped: SkippedPool[];
};

/**
 * @function sourceKey
 * @param source {{ kind: string; id: string }} a pool at a source
 * @returns {string} "otdb:58"
 */
export const sourceKey = (source: { kind: string; id: string }): string =>
  `${source.kind}:${source.id}`;

/**
 * @function planArchiveImport
 * @param pools {readonly NormalizedPool[]} the import's pools, in the order to create them
 * @param skipped {readonly SkippedPool[]} pools already left out, carried into the plan
 * @param existing {readonly ExistingArchivePack[]} the archive packs stored now
 * @returns {ArchivePlan} what to create, which stored packs gain sources, what's unchanged,
 *          merged within the import, changed at its source, and skipped
 */
export const planArchiveImport = (
  pools: readonly NormalizedPool[],
  skipped: readonly SkippedPool[],
  existing: readonly ExistingArchivePack[],
): ArchivePlan => {
  const byFingerprint = new Map(existing.map((pack) => [pack.fingerprint, pack]));
  const bySource = new Map<string, ExistingArchivePack[]>();
  for (const pack of existing) {
    for (const source of pack.sources) {
      const key = sourceKey(source);
      bySource.set(key, [...(bySource.get(key) ?? []), pack]);
    }
  }
  const creates = new Map<string, PlannedCreate>();
  const updates = new Map<string, PlannedUpdate>();
  const plan: ArchivePlan = {
    create: [],
    update: [],
    unchanged: [],
    merged: [],
    changed: [],
    skipped: [...skipped],
  };
  for (const pool of pools) {
    const key = sourceKey(pool.source);
    const stored = byFingerprint.get(pool.fingerprint);
    let to: ChangedPool["to"];
    if (stored) {
      if (stored.sources.some((source) => sourceKey(source) === key)) {
        plan.unchanged.push({ slug: stored.slug, name: stored.name, source: pool.source });
        continue;
      }
      const update = updates.get(stored.slug) ?? {
        slug: stored.slug,
        name: stored.name,
        sources: [],
      };
      if (!update.sources.some((source) => sourceKey(source) === key))
        update.sources.push(pool.source);
      updates.set(stored.slug, update);
      to = { slug: stored.slug, name: stored.name };
    } else {
      const planned = creates.get(pool.fingerprint);
      if (planned) {
        if (planned.sources.some((source) => sourceKey(source) === key)) continue;
        planned.sources.push(pool.source);
        plan.merged.push({
          source: pool.source,
          into: planned.pool.source,
          name: planned.pool.input.name,
        });
      } else {
        creates.set(pool.fingerprint, { pool, sources: [pool.source] });
      }
      to = { slug: null, name: planned?.pool.input.name ?? pool.input.name };
    }
    for (const old of bySource.get(key) ?? []) {
      if (old.fingerprint === pool.fingerprint) continue;
      plan.changed.push({ source: pool.source, from: { slug: old.slug, name: old.name }, to });
    }
  }
  plan.create = [...creates.values()];
  plan.update = [...updates.values()];
  return plan;
};

export const IMPORT_USAGE = "Usage: bun run archive:import otdb [--dry-run] [--file <path>]";

/** Sources the runner can import so far. */
export const IMPORTABLE_SOURCES: readonly ArchiveSourceKind[] = Object.freeze(["otdb"]);

export type ImportArgs = { source: ArchiveSourceKind; dryRun: boolean; file: string | null };

/**
 * @function parseImportArgs
 * @param argv {readonly string[]} the runner's arguments (after the script name)
 * @returns {{ ok: true; args: ImportArgs } | { ok: false; error: string }} the source, --dry-run,
 *          and --file <path> (or --file=<path>); an error for a missing or unknown source, a
 *          --file without a path, a repeated option, or anything else
 */
export const parseImportArgs = (
  argv: readonly string[],
): { ok: true; args: ImportArgs } | { ok: false; error: string } => {
  let source: ArchiveSourceKind | null = null;
  let dryRun = false;
  let file: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--dry-run") {
      if (dryRun) return { ok: false, error: "--dry-run is given twice." };
      dryRun = true;
    } else if (arg === "--file" || arg.startsWith("--file=")) {
      if (file !== null) return { ok: false, error: "--file is given twice." };
      const value = arg === "--file" ? argv[++i] : arg.slice("--file=".length);
      if (!value || value.startsWith("--")) return { ok: false, error: "--file needs a path." };
      file = value;
    } else if (arg.startsWith("-")) {
      return { ok: false, error: `Unknown option ${arg}.` };
    } else if (source !== null) {
      return { ok: false, error: `Only one source at a time (got ${source} and ${arg}).` };
    } else {
      const kind = IMPORTABLE_SOURCES.find((known) => known === arg);
      if (!kind) {
        return {
          ok: false,
          error: `Can't import from ${arg}. Sources: ${IMPORTABLE_SOURCES.join(", ")}.`,
        };
      }
      source = kind;
    }
  }
  if (source === null) return { ok: false, error: "Name a source to import from." };
  return { ok: true, args: { source, dryRun, file } };
};

/** C0 and C1 control characters, DEL included (Unicode's Cc). */
const CONTROL = /\p{Cc}/gu;

/** The most characters of one piece of source text the report prints. */
const REPORT_TEXT_MAX = 200;

/**
 * @function reportText
 * @param text {string} text a source gave (a pool name, a slot label inside a reason)
 * @returns {string} the same, safe to print to the admin's terminal: every control character
 *          (escape sequences, bells, line breaks) as U+FFFD, and at most REPORT_TEXT_MAX
 *          characters, cut with an ellipsis
 */
export const reportText = (text: string): string => {
  const safe = text.replace(CONTROL, "\uFFFD");
  return safe.length > REPORT_TEXT_MAX ? `${safe.slice(0, REPORT_TEXT_MAX - 1)}…` : safe;
};

const label = (source: { kind: ArchiveSourceKind; id: string }): string =>
  `${ARCHIVE_SOURCE_LABELS[source.kind]} #${reportText(source.id)}`;

/**
 * @function formatImportReport
 * @param plan {ArchivePlan} the plan
 * @param options {{ read: number; dryRun: boolean; source: ArchiveSourceKind }} how many pools
 *        the source listed, whether this was a dry run, and the source
 * @returns {string} the summary the runner prints: a count table (new, updated, unchanged,
 *          merged, changed, skipped), then each skipped pool with its reason, each pool merged
 *          within the import, each changed pool, and each stored pack that gains a source
 */
export const formatImportReport = (
  plan: ArchivePlan,
  { read, dryRun, source }: { read: number; dryRun: boolean; source: ArchiveSourceKind },
): string => {
  const rows: [string, number][] = [
    ["New packs", plan.create.length],
    ["Updated (new source)", plan.update.length],
    ["Unchanged", plan.unchanged.length],
    ["Same pool twice", plan.merged.length],
    ["Changed pools", plan.changed.length],
    ["Skipped", plan.skipped.length],
  ];
  const width = Math.max(...rows.map(([name]) => name.length));
  const lines = [
    `${ARCHIVE_SOURCE_LABELS[source]}: ${read} ${read === 1 ? "pool" : "pools"} read.${
      dryRun ? " Dry run: nothing was written." : ""
    }`,
    "",
    ...rows.map(([name, count]) => `  ${name.padEnd(width)}  ${String(count).padStart(5)}`),
  ];
  const section = (title: string, entries: string[]) => {
    if (entries.length > 0) lines.push("", title, ...entries.map((entry) => `  ${entry}`));
  };
  section(
    "Skipped:",
    plan.skipped.map(
      (pool) => `${label(pool)}  ${reportText(pool.name)}: ${reportText(pool.reason)}`,
    ),
  );
  section(
    "Same pool twice in this import (one pack with both sources):",
    plan.merged.map(
      (pool) =>
        `${label(pool.source)} is the same pool as ${label(pool.into)} (${reportText(pool.name)})`,
    ),
  );
  section(
    "Changed pools (the old pack stays):",
    plan.changed.map(
      (pool) =>
        `${label(pool.source)}  was ${pool.from.slug} (${reportText(pool.from.name)}), now ${
          pool.to.slug === null ? "a new pack" : pool.to.slug
        } (${reportText(pool.to.name)})`,
    ),
  );
  section(
    "New sources on stored packs:",
    plan.update.map(
      (pack) =>
        `${pack.slug} (${reportText(pack.name)}) gains ${pack.sources.map(label).join(", ")}`,
    ),
  );
  return lines.join("\n");
};
