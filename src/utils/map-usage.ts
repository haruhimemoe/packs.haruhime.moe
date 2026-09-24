/**
 * @file src/utils/map-usage.ts
 * @desc Map usage: which archive packs used a beatmap, built from the
 *       packs themselves. One entry per slot a map fills (a pool with the map in two slots gives
 *       two), in one fixed order: most recent year first, then pools without a year, then by
 *       tournament, round, slug and slot. `count` is how many pools, so a pool that uses a map
 *       twice counts once. Each entry carries its pool's fingerprint, so a page can leave out the
 *       pool it shows. planUsageWrites turns a rebuild into the fewest writes. Also what a map
 *       row shows, and the text a pool fingerprint hashes. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { bucketsOf, isModBucket, modsLabel, type SlotMods, slotLabel } from "@haruhimemoe/pool";
import { z } from "zod";
import { fingerprintSchema } from "@/schemas/archive";
import { type BeatmapUsage, type MapUsageEntry, mapUsageEntrySchema } from "@/schemas/map-usage";
import {
  type BucketEntry,
  type PoolSlot,
  poolFields,
  poolSlotSchema,
  slotKey,
} from "@/schemas/pack";
import { slugSchema } from "@/schemas/saved-pack";
import { slotModsMap } from "@/utils/slot-stars";
import { storedBuckets } from "@/utils/stored-buckets";

/**
 * @function slotModsCode
 * @param slot {PoolSlot} a slot
 * @param mods {SlotMods | undefined} what its bucket plays with (slotModsMap)
 * @returns {string} what the slot plays with, as fingerprints and map usage write it: a built-in
 *          slot's code (NM, HD, HR, DT, FM, TB), a custom slot's forced mods ("HDHR"), FM for a
 *          custom free mod slot, NM for a custom slot without mods and for a map without a slot
 */
export const slotModsCode = (slot: PoolSlot, mods: SlotMods | undefined): string => {
  if (slot.mod !== null && isModBucket(slot.mod)) return slot.mod;
  if (mods?.kind === "forced") return modsLabel(mods.set);
  return mods?.kind === "free" ? "FM" : "NM";
};

/**
 * @function fingerprintText
 * @param pool {{ slots: readonly PoolSlot[]; buckets?: readonly BucketEntry[] }} a pool
 * @returns {string} what a pool fingerprint hashes (sha256, lowercase hex): one "beatmapId:mods"
 *          line per slot (slotModsCode), sorted. The importer hashes it with node:crypto, the
 *          browser with crypto.subtle, so both get the same fingerprint for the same pool.
 */
export const fingerprintText = (pool: {
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
}): string => {
  const mods = slotModsMap(pool.slots, bucketsOf(pool));
  return pool.slots
    .map((slot) => `${slot.beatmapId}:${slotModsCode(slot, mods.get(slotKey(slot)))}`)
    .sort()
    .join("\n");
};

/** An archive pack as map usage needs it. */
export type UsagePack = {
  slug: string;
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
  archive: {
    tournament: string;
    round: string | null;
    year: number | null;
    badged: boolean | null;
    fingerprint: string;
  };
};

const usagePackSchema = z.object({
  slug: slugSchema,
  slots: z.array(poolSlotSchema),
  buckets: poolFields.shape.buckets,
  archive: z.object({
    tournament: z.string().min(1),
    round: z.string().nullable(),
    year: z.number().int().nullable(),
    badged: z.boolean().nullable(),
    fingerprint: fingerprintSchema,
  }),
});

/** A stored pack document, or the projection map usage reads. Unchecked until usagePackOf. */
export type StoredUsagePack = {
  slug?: unknown;
  slots?: unknown;
  buckets?: unknown;
  archive?: {
    tournament?: unknown;
    round?: unknown;
    year?: unknown;
    badged?: unknown;
    fingerprint?: unknown;
  } | null;
};

/**
 * @function usagePackOf
 * @param doc {StoredUsagePack} a stored pack document (or its projection)
 * @returns {UsagePack | null} the pack as map usage reads it, or null when it isn't an archive
 *          pack or doesn't parse (a bad row is left out, never breaking the rest)
 */
export const usagePackOf = (doc: StoredUsagePack): UsagePack | null => {
  if (!doc.archive) return null;
  const { tournament, round, year, badged, fingerprint } = doc.archive;
  const parsed = usagePackSchema.safeParse({
    slug: doc.slug,
    slots: doc.slots,
    buckets: storedBuckets(doc.buckets),
    archive: {
      tournament,
      round: round ?? null,
      year: year ?? null,
      badged: badged ?? null,
      fingerprint,
    },
  });
  return parsed.success ? parsed.data : null;
};

/**
 * @function packUsage
 * @param pack {UsagePack} an archive pack
 * @returns {{ beatmapId: number; entry: MapUsageEntry }[]} one entry per slot, in slot order
 */
export const packUsage = (pack: UsagePack): { beatmapId: number; entry: MapUsageEntry }[] => {
  const mods = slotModsMap(pack.slots, bucketsOf(pack));
  const { tournament, round, year, badged, fingerprint } = pack.archive;
  return pack.slots.map((slot) => ({
    beatmapId: slot.beatmapId,
    entry: {
      slug: pack.slug,
      tournament,
      round,
      year,
      badged,
      slot: slotLabel(slot),
      mods: slotModsCode(slot, mods.get(slotKey(slot))),
      fingerprint,
    },
  }));
};

/** Code-unit order: the same everywhere, whatever the locale. */
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @function compareUsageEntries
 * @param a {MapUsageEntry} an entry
 * @param b {MapUsageEntry} another
 * @returns {number} negative when a comes first: most recent year first, entries without a year
 *          last, then by tournament, round (none first), slug and slot
 */
export const compareUsageEntries = (a: MapUsageEntry, b: MapUsageEntry): number => {
  if (a.year !== b.year) {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  }
  return (
    byText(a.tournament, b.tournament) ||
    byText(a.round ?? "", b.round ?? "") ||
    byText(a.slug, b.slug) ||
    byText(a.slot, b.slot)
  );
};

/**
 * @function buildMapUsage
 * @param packs {readonly UsagePack[]} the archive packs that count (public, not hidden)
 * @param only {ReadonlySet<number>} when given, only these beatmap ids
 * @returns {Map<number, MapUsageEntry[]>} beatmap id -> its entries, sorted
 *          (compareUsageEntries); ids no pack uses are absent
 */
export const buildMapUsage = (
  packs: readonly UsagePack[],
  only?: ReadonlySet<number>,
): Map<number, MapUsageEntry[]> => {
  const byId = new Map<number, MapUsageEntry[]>();
  for (const pack of packs) {
    for (const { beatmapId, entry } of packUsage(pack)) {
      if (only && !only.has(beatmapId)) continue;
      const list = byId.get(beatmapId);
      if (list) list.push(entry);
      else byId.set(beatmapId, [entry]);
    }
  }
  for (const list of byId.values()) list.sort(compareUsageEntries);
  return byId;
};

/**
 * @function storedUsageEntries
 * @param value {unknown} a stored usage document's `entries`
 * @returns {MapUsageEntry[]} the entries that parse, in stored order (a bad one is left out)
 */
export const storedUsageEntries = (value: unknown): MapUsageEntry[] =>
  Array.isArray(value)
    ? value.flatMap((entry: unknown) => {
        const parsed = mapUsageEntrySchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

/**
 * @function usagePoolCount
 * @param entries {readonly MapUsageEntry[]} a map's entries
 * @returns {number} how many pools they come from
 */
export const usagePoolCount = (entries: readonly MapUsageEntry[]): number =>
  new Set(entries.map((entry) => entry.slug)).size;

/**
 * @function toBeatmapUsage
 * @param beatmapId {number} the map
 * @param entries {readonly MapUsageEntry[]} its entries, sorted
 * @returns {BeatmapUsage} the API's answer for it
 */
export const toBeatmapUsage = (
  beatmapId: number,
  entries: readonly MapUsageEntry[],
): BeatmapUsage => ({ beatmapId, count: usagePoolCount(entries), entries: [...entries] });

const sameEntry = (a: MapUsageEntry, b: MapUsageEntry): boolean =>
  a.slug === b.slug &&
  a.tournament === b.tournament &&
  a.round === b.round &&
  a.year === b.year &&
  a.badged === b.badged &&
  a.slot === b.slot &&
  a.mods === b.mods &&
  a.fingerprint === b.fingerprint;

const sameEntries = (a: readonly MapUsageEntry[], b: readonly MapUsageEntry[]): boolean =>
  a.length === b.length && a.every((entry, i) => sameEntry(entry, b[i] as MapUsageEntry));

/**
 * @function sameUsage
 * @param a {ReadonlyMap<number, readonly MapUsageEntry[]>} usage by beatmap id
 * @param b {ReadonlyMap<number, readonly MapUsageEntry[]>} other usage by beatmap id
 * @returns {boolean} whether both hold the same ids with the same entries in the same order
 */
export const sameUsage = (
  a: ReadonlyMap<number, readonly MapUsageEntry[]>,
  b: ReadonlyMap<number, readonly MapUsageEntry[]>,
): boolean => {
  if (a.size !== b.size) return false;
  for (const [id, entries] of a) {
    const other = b.get(id);
    if (!other || !sameEntries(entries, other)) return false;
  }
  return true;
};

export type UsageWrites = {
  /** Beatmap ids whose stored entries change, with the new ones. */
  set: [number, MapUsageEntry[]][];
  /** Beatmap ids no counted pack uses any more. */
  remove: number[];
};

/**
 * @function planUsageWrites
 * @param scope {Iterable<number>} the beatmap ids being rebuilt
 * @param stored {ReadonlyMap<number, readonly MapUsageEntry[]>} what's stored for them now
 * @param next {ReadonlyMap<number, MapUsageEntry[]>} what they should hold (buildMapUsage)
 * @returns {UsageWrites} each id once: a write where the entries differ, a removal where nothing
 *          uses the map any more, and nothing where they already match
 */
export const planUsageWrites = (
  scope: Iterable<number>,
  stored: ReadonlyMap<number, readonly MapUsageEntry[]>,
  next: ReadonlyMap<number, MapUsageEntry[]>,
): UsageWrites => {
  const writes: UsageWrites = { set: [], remove: [] };
  for (const id of new Set(scope)) {
    const entries = next.get(id) ?? [];
    const current = stored.get(id);
    if (entries.length > 0) {
      if (!current || !sameEntries(current, entries)) writes.set.push([id, entries]);
    } else if (current) {
      writes.remove.push(id);
    }
  }
  return writes;
};

/**
 * @function usageElsewhere
 * @param entries {readonly MapUsageEntry[]} a map's entries
 * @param shown {{ slug?: string; fingerprint?: string }} the pack being shown, and the
 *        fingerprint of the pool it holds: entries of either are left out (a key or a copy of an
 *        archive pool is that pool, whatever its slug)
 * @returns {readonly MapUsageEntry[]} the entries from other pools
 */
export const usageElsewhere = (
  entries: readonly MapUsageEntry[],
  { slug, fingerprint }: { slug?: string | undefined; fingerprint?: string | undefined },
): readonly MapUsageEntry[] =>
  slug === undefined && fingerprint === undefined
    ? entries
    : entries.filter((entry) => entry.slug !== slug && entry.fingerprint !== fingerprint);

/**
 * @function usageLabel
 * @param pools {number} how many pools used a map
 * @returns {string} "Used in 1 pool", "Used in 3 pools"
 */
export const usageLabel = (pools: number): string =>
  `Used in ${pools} ${pools === 1 ? "pool" : "pools"}`;

/**
 * @function usageEntryText
 * @param entry {MapUsageEntry} one use
 * @returns {{ pool: string; details: string }} the pool ("osu! World Cup 2023 · Grand Finals"),
 *          and its year and slot ("2023 · NM1", or just the slot)
 */
export const usageEntryText = (entry: MapUsageEntry): { pool: string; details: string } => ({
  pool: entry.round ? `${entry.tournament} · ${entry.round}` : entry.tournament,
  details: entry.year === null ? entry.slot : `${entry.year} · ${entry.slot}`,
});
