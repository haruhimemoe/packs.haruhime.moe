/**
 * @file src/utils/archive-pools.ts
 * @desc Source pools to archive packs, for any source. Slot labels go through
 *       @haruhimemoe/pool's pasted-pool parsing ("NM1", "HD2", "TB", and custom labels like
 *       "HDHR1" or "EZ1", which become custom slots forcing those mods when the label spells a
 *       valid set); plain numbers ("#1", "12") are maps without a slot. When the source lists
 *       each map's mods, a rating mod every map under a label carries goes into the slot (an EZ
 *       tournament's HD1 is EZHD1), and a pool whose no-mod slots mix mods is skipped rather than
 *       imported as no mod (checkSourceMods). A pool that doesn't parse cleanly, or fails pack
 *       validation (the content filter on its name and slot labels included), is skipped with a
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
  bucketsOf,
  isModAcronym,
  isModBucket,
  MAX_SLOT_INDEX,
  MOD_ACRONYMS,
  type ModAcronym,
  modSetProblem,
  modsLabel,
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
import { slotModsMap } from "@/utils/slot-stars";

/** One pool at one source. */
export type ArchiveSourceRef = { kind: ArchiveSourceKind; id: string; url: string };

/**
 * A map as a source lists it: its slot label, osu! beatmap (difficulty) id, and the mods the
 * source says it was played with (acronyms as the source writes them), when it says.
 */
export type SourceSlot = { label: string; beatmapId: number; mods?: readonly string[] };

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

/** Mods that change a map's star rating, as sources write them: NC is DT, DC is HT. */
const RATING_MODS: Readonly<Record<string, ModAcronym>> = Object.freeze({
  EZ: "EZ",
  HR: "HR",
  DT: "DT",
  NC: "DT",
  HT: "HT",
  DC: "HT",
  FL: "FL",
});

/**
 * @function ratingModsOf
 * @param mods {readonly string[]} a map's mods as its source writes them ("ez", "NC", "HD")
 * @returns {ModAcronym[]} the ones that change its star rating, in canonical order (NC as DT,
 *          DC as HT; HD, FM, TB and the rest dropped)
 */
export const ratingModsOf = (mods: readonly string[]): ModAcronym[] => {
  const found = new Set(mods.flatMap((mod) => RATING_MODS[mod.toUpperCase()] ?? []));
  return MOD_ACRONYMS.filter((mod) => found.has(mod));
};

/** "#1", "12": a numbered map without a slot. */
const NUMBERED = /^#?\s*(\d{1,3})$/u;

type LabelResult = { ok: true; pool: Pool } | { ok: false; reason: string };

/**
 * @function poolFromLabels
 * @param name {string} the pool's name
 * @param slots {readonly SourceSlot[]} its maps, in the source's order
 * @param force {ReadonlyMap<string, readonly ModAcronym[]>} mods to force on custom codes that
 *        spell none (from the source's mods, checkSourceMods)
 * @returns {LabelResult} the pool (slots in the source's order, custom slots with the mods their
 *          codes spell or `force` gives), or the first reason it can't be read: an empty or
 *          multi-line label, a label the pasted-pool parser refuses (a slot twice, too many
 *          custom slots...), or a slot number out of range
 */
export const poolFromLabels = (
  name: string,
  slots: readonly SourceSlot[],
  force: ReadonlyMap<string, readonly ModAcronym[]> = new Map(),
): LabelResult => {
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
    const set = modsFromSlotCode(bucket.code) ?? force.get(bucket.code);
    if (set) pool = setBucketMods(pool, bucket.code, { kind: "forced", set: [...set] });
  }
  return { ok: true, pool };
};

type ModsCheck =
  | { ok: true; relabel: Map<number, string>; force: Map<string, ModAcronym[]> }
  | { ok: false; reason: string };

const setLabel = (set: readonly ModAcronym[]): string => (set.length === 0 ? "NM" : modsLabel(set));

/**
 * @function checkSourceMods
 * @param pool {Pool} the pool as its labels read (poolFromLabels: slots in the source's order)
 * @param mods {readonly (readonly string[])[]} each map's mods at the source, in the same order
 * @returns {ModsCheck} what the source's mods change, or why the pool can't be held. Per slot
 *          label (maps without a slot are one group; free mod slots are left alone), a rating mod
 *          the label doesn't force is "extra". When every map under a label has the same extra
 *          mods, and there are two or more of them or every map in the pool carries those mods
 *          (one map alone could be otdb's entry from another pool), they go into the slot: a
 *          label that spells mods becomes one spelling both (HD1 played with EZ is EZHD1), and a
 *          custom label that spells none forces them. Otherwise a label that spells mods decides
 *          (NM, HD, HR, DT, "HDDT"), while a no-mod custom label, or maps without a slot, with
 *          extra mods can't be held, so the pool is skipped rather than imported as no mod.
 */
export const checkSourceMods = (pool: Pool, mods: readonly (readonly string[])[]): ModsCheck => {
  const played = pool.slots.map((_, i) => ratingModsOf(mods[i] ?? []));
  const everywhere = MOD_ACRONYMS.filter((mod) => played.every((set) => set.includes(mod)));
  const slotMods = slotModsMap(pool.slots, bucketsOf(pool));
  const groups = new Map<string | null, number[]>();
  pool.slots.forEach((slot, i) => {
    groups.set(slot.mod, [...(groups.get(slot.mod) ?? []), i]);
  });
  const relabel = new Map<number, string>();
  const force = new Map<string, ModAcronym[]>();
  for (const [code, members] of groups) {
    const first = pool.slots[members[0] ?? 0];
    const own = first ? slotMods.get(slotKey(first)) : undefined;
    if (own?.kind === "free") continue;
    const forced = own?.kind === "forced" ? own.set : [];
    const extras = members.map((i) => (played[i] ?? []).filter((mod) => !forced.includes(mod)));
    const labels = [...new Set(extras.map(setLabel))];
    if (labels.length === 1 && labels[0] === "NM") continue;
    const extra = extras[0] ?? [];
    const shared =
      labels.length === 1 &&
      (members.length >= 2 || extra.every((mod) => everywhere.includes(mod)));
    if (code === null) {
      return {
        ok: false,
        reason: `Maps without a slot are played with mods (${labels.join(", ")}), which a map without a slot can't hold.`,
      };
    }
    const spellsMods = isModBucket(code) || forced.length > 0;
    if (!shared) {
      if (spellsMods) continue;
      return {
        ok: false,
        reason: `Slot ${code}: its maps are played with different mods (${labels.join(", ")}), which one slot can't hold.`,
      };
    }
    if (!spellsMods) {
      force.set(code, extra);
      continue;
    }
    const set = MOD_ACRONYMS.filter((mod) => forced.includes(mod) || extra.includes(mod));
    if (modSetProblem(set) !== null) {
      return {
        ok: false,
        reason: `Slot ${code}: its maps are played with ${modsLabel(extra)} too, and ${modsLabel(set)} can't be forced together.`,
      };
    }
    for (const i of members) {
      const slot = pool.slots[i];
      if (slot) relabel.set(i, `${modsLabel(set)}${slot.index}`);
    }
  }
  return { ok: true, relabel, force };
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
  // Control characters (escape sequences) have no place in a name that's stored and shown.
  if (/\p{Cc}/u.test(pool.name)) {
    return skip("The pool name has control characters.");
  }
  let labelled = poolFromLabels(pool.name, pool.slots);
  if (!labelled.ok) return skip(labelled.reason);
  // What the source says the maps were played with, when it says it for every map.
  const sourceMods = pool.slots.flatMap((slot) => (slot.mods ? [slot.mods] : []));
  if (sourceMods.length === pool.slots.length && sourceMods.length > 0) {
    const check = checkSourceMods(labelled.pool, sourceMods);
    if (!check.ok) return skip(check.reason);
    if (check.relabel.size > 0 || check.force.size > 0) {
      const relabelled = pool.slots.map((slot, i) => ({
        ...slot,
        label: check.relabel.get(i) ?? slot.label,
      }));
      labelled = poolFromLabels(pool.name, relabelled, check.force);
      if (!labelled.ok) return skip(labelled.reason);
    }
  }
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
