/**
 * @file src/utils/archive-pools.ts
 * @desc Source pools to archive packs (pool archive spec), for any source. Slot labels go through
 *       @haruhimemoe/pool's pasted-pool parsing ("NM1", "HD2", "TB", and custom labels like
 *       "HDHR1" or "EZ1", which become custom slots forcing those mods when the label spells a
 *       valid set); plain numbers ("#1", "12") are maps without a slot. A pool that doesn't parse
 *       cleanly, or fails pack validation (the content filter on its name and slot labels
 *       included), is skipped with a
 *       reason, never half-imported. Each pool gets its tournament, round and year from its
 *       name, a fingerprint (sha256 of its sorted "beatmapId:mods" entries: the same maps with
 *       the same mods in any order, from any source, give the same one), and stats seeded from
 *       the source's own map details. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { createHash } from "node:crypto";
import {
  addBuckets,
  isModAcronym,
  MAX_SLOT_INDEX,
  MOD_ACRONYMS,
  type ModAcronym,
  modSetProblem,
  type Pool,
  parsePoolText,
  setBucketMods,
  slotTitle,
} from "@haruhimemoe/pool";
import { ARCHIVE_SOURCE_LABELS, type ArchiveSourceKind } from "@/constants/archive";
import { type BucketEntry, type PoolSlot, slotKey } from "@/schemas/pack";
import { type PackInput, packInputSchema } from "@/schemas/saved-pack";
import { type ArchiveName, parseArchiveName } from "@/utils/archive-names";
import { fingerprintText } from "@/utils/map-usage";
import { computeStats, type PackStatsRecord, type StatsMetaById } from "@/utils/saved-pack-stats";

/** One pool at one source. */
export type ArchiveSourceRef = { kind: ArchiveSourceKind; id: string; url: string };

/** A map as a source lists it: its slot label and osu! beatmap (difficulty) id. */
export type SourceSlot = { label: string; beatmapId: number };

/** A pool as a source gives it. */
export type SourcePool = { source: ArchiveSourceRef; name: string; slots: readonly SourceSlot[] };

/** A pool ready to become (or match) an archive pack. */
export type NormalizedPool = {
  source: ArchiveSourceRef;
  /** Validated like any saved pack: public, with a description crediting the source. */
  input: PackInput;
  archive: ArchiveName;
  fingerprint: string;
  /** From the source's map details; incomplete until the ratings with mods are looked up. */
  stats: PackStatsRecord;
};

/** A pool the import leaves out, and why. */
export type SkippedPool = { kind: ArchiveSourceKind; id: string; name: string; reason: string };

/**
 * @function modsFromSlotCode
 * @param code {string} a custom slot code ("HDHR", "EZ", "DTHD")
 * @returns {ModAcronym[] | null} the mods it spells, in canonical order, when the whole code is
 *          mod acronyms that can be forced together ("HDHR" is HD + HR); null otherwise ("SV",
 *          "EZHR", "HDHD")
 */
export const modsFromSlotCode = (code: string): ModAcronym[] | null => {
  const upper = code.toUpperCase();
  if (!/^(?:[A-Z]{2})+$/u.test(upper)) return null;
  const pairs: string[] = upper.match(/[A-Z]{2}/gu) ?? [];
  if (!pairs.every((pair) => isModAcronym(pair))) return null;
  const set = MOD_ACRONYMS.filter((mod) => pairs.includes(mod));
  if (set.length !== pairs.length) return null;
  return modSetProblem(set) === null ? set : null;
};

/** "#1", "12": a numbered map without a slot. */
const NUMBERED = /^#?\s*(\d{1,3})$/u;

type LabelResult = { ok: true; pool: Pool } | { ok: false; reason: string };

/**
 * @function poolFromLabels
 * @param name {string} the pool's name
 * @param slots {readonly SourceSlot[]} its maps, in the source's order
 * @returns {LabelResult} the pool (slots in the source's order, custom slots with the mods their
 *          codes spell), or the first reason it can't be read: an empty or multi-line label, a
 *          label the pasted-pool parser refuses (a slot twice, too many custom slots...), or a
 *          slot number out of range
 */
export const poolFromLabels = (name: string, slots: readonly SourceSlot[]): LabelResult => {
  const fail = (reason: string): LabelResult => ({ ok: false, reason });
  const lines: string[] = [];
  const labels: string[] = [];
  for (const { label, beatmapId } of slots) {
    const text = label.trim();
    if (text === "") return fail("A map has no slot label.");
    if (/[\r\n]/u.test(text))
      return fail(`The slot label ${JSON.stringify(text)} has a line break.`);
    if (NUMBERED.test(text)) continue;
    lines.push(`${text} ${beatmapId}`);
    labels.push(text);
  }
  const parsed = parsePoolText(lines.join("\n"), { slots: [] });
  const [error] = parsed.errors;
  if (error) return fail(`Slot ${labels[error.line - 1] ?? error.text}: ${error.reason}`);
  // A label the parser reads as a comment ("#A") gives no slot and no error.
  if (parsed.slots.length !== lines.length) return fail("A slot label couldn't be read.");

  const ordered: PoolSlot[] = [];
  let next = 0;
  for (const { label, beatmapId } of slots) {
    const number = NUMBERED.exec(label.trim());
    if (!number) {
      const slot = parsed.slots[next++];
      if (slot) ordered.push(slot);
      continue;
    }
    const index = Number(number[1]);
    if (index < 1 || index > MAX_SLOT_INDEX) {
      return fail(`Slot ${label.trim()}: slot numbers go from 1 to ${MAX_SLOT_INDEX}.`);
    }
    ordered.push({ mod: null, index, beatmapId });
  }
  const seen = new Set<string>();
  for (const slot of ordered) {
    if (seen.has(slotKey(slot))) return fail(`${slotTitle(slot)} appears more than once.`);
    seen.add(slotKey(slot));
  }

  let pool: Pool = addBuckets({ name, slots: ordered }, parsed.newBuckets);
  for (const bucket of parsed.newBuckets) {
    const set = modsFromSlotCode(bucket.code);
    if (set) pool = setBucketMods(pool, bucket.code, { kind: "forced", set });
  }
  return { ok: true, pool };
};

/**
 * @function poolFingerprint
 * @param pool {{ slots: readonly PoolSlot[]; buckets?: readonly BucketEntry[] }} a pool
 * @returns {string} sha256 (lowercase hex) of its fingerprintText: its sorted "beatmapId:mods"
 *          entries, one per slot: a built-in slot's code (NM, HD, HR, DT, FM, TB), a custom
 *          slot's forced mods ("HDHR"), FM for a custom freemod slot, NM for one without mods and
 *          for maps without a slot. Slot order, labels and colors don't change it; maps and mods
 *          do.
 */
export const poolFingerprint = (pool: {
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
}): string => createHash("sha256").update(fingerprintText(pool), "utf8").digest("hex");

/**
 * @function archiveDescription
 * @param source {ArchiveSourceRef} where the pool came from
 * @returns {string} the pack's one-line description crediting the source with its link
 */
export const archiveDescription = (source: ArchiveSourceRef): string =>
  `Archived from ${ARCHIVE_SOURCE_LABELS[source.kind]} pool #${source.id}: ${source.url}`;

type NormalizeResult = { ok: true; pool: NormalizedPool } | { ok: false; skipped: SkippedPool };

/**
 * @function normalizePool
 * @param pool {SourcePool} a pool as its source gives it
 * @param meta {StatsMetaById} the source's map details by beatmap id (for the seeded stats)
 * @param now {Date} when the stats count as computed
 * @returns {NormalizeResult} the normalized pool, or why it's skipped (its labels don't parse, or
 *          the pack fails validation: its name, the content filter, too many maps, none at all)
 */
export const normalizePool = (
  pool: SourcePool,
  meta: StatsMetaById,
  now: Date,
): NormalizeResult => {
  const skip = (reason: string): NormalizeResult => ({
    ok: false,
    skipped: { kind: pool.source.kind, id: pool.source.id, name: pool.name, reason },
  });
  const labelled = poolFromLabels(pool.name, pool.slots);
  if (!labelled.ok) return skip(labelled.reason);
  const checked = packInputSchema.safeParse({
    name: labelled.pool.name,
    slots: labelled.pool.slots,
    ...(labelled.pool.buckets ? { buckets: labelled.pool.buckets } : {}),
    description: archiveDescription(pool.source),
    visibility: "public",
  });
  if (!checked.success) {
    const [issue] = checked.error.issues;
    return skip(issue ? `${issue.path.join(".") || "pack"}: ${issue.message}` : "Invalid pack.");
  }
  const input = checked.data;
  return {
    ok: true,
    pool: {
      source: pool.source,
      input,
      archive: parseArchiveName(input.name),
      fingerprint: poolFingerprint(input),
      stats: computeStats(input.slots, input.buckets, meta, new Map(), now),
    },
  };
};

/** Numeric ids in number order, then everything else in text order. */
const byId = (a: { id: string }, b: { id: string }): number => {
  const [x, y] = [Number(a.id), Number(b.id)];
  if (Number.isInteger(x) && Number.isInteger(y)) return x - y;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * @function normalizePools
 * @param pools {readonly SourcePool[]} one source's pools
 * @param meta {StatsMetaById} that source's map details
 * @param now {Date} when the stats count as computed
 * @returns {{ pools: NormalizedPool[]; skipped: SkippedPool[] }} the pools that normalize, in id
 *          order (so packs are created oldest pool first), and the rest with reasons; a pool id
 *          the source lists twice keeps its first entry
 */
export const normalizePools = (
  pools: readonly SourcePool[],
  meta: StatsMetaById,
  now: Date,
): { pools: NormalizedPool[]; skipped: SkippedPool[] } => {
  const normalized: NormalizedPool[] = [];
  const skipped: SkippedPool[] = [];
  const seen = new Set<string>();
  for (const pool of [...pools].sort((a, b) => byId(a.source, b.source))) {
    if (seen.has(pool.source.id)) {
      skipped.push({
        kind: pool.source.kind,
        id: pool.source.id,
        name: pool.name,
        reason: "The source lists this pool id twice; the first one was used.",
      });
      continue;
    }
    seen.add(pool.source.id);
    const result = normalizePool(pool, meta, now);
    if (result.ok) normalized.push(result.pool);
    else skipped.push(result.skipped);
  }
  return { pools: normalized, skipped };
};
