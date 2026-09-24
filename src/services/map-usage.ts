/**
 * @file src/services/map-usage.ts
 * @desc Map usage in the database (pool archive spec, part 2): the map_usage collection, one
 *       document per beatmap id ({ _id, entries, updatedAt }), built from archive packs only
 *       (public and not hidden: the packs anyone can open). rebuildMapUsage rebuilds the given
 *       beatmaps, or all of them, from the packs and writes only what changed, going round again
 *       when the packs changed while it wrote (two rebuilds racing). Moderation
 *       (hide, unhide, delete), archive pack edits and deletes call refreshMapUsage for the maps
 *       they touch; the importer rebuilds everything at the end of a real run. getMapUsage
 *       answers the public API. Reads and writes go through the driver: the collection holds no
 *       user data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { AnyBulkWriteOperation } from "mongodb";
import { MAP_USAGE_COLLECTION } from "@/constants/map-usage";
import { connectedDb } from "@/lib/db";
import type { BeatmapUsage, MapUsageEntry } from "@/schemas/map-usage";
import {
  buildMapUsage,
  planUsageWrites,
  type StoredUsagePack,
  sameUsage,
  storedUsageEntries,
  toBeatmapUsage,
  type UsagePack,
  usagePackOf,
} from "@/utils/map-usage";

type UsageDoc = { _id: number; entries: MapUsageEntry[]; updatedAt: Date };

/** Archive packs that count: public and not hidden (`hiddenAt: null` also matches a missing field). */
const COUNTED = {
  "archive.fingerprint": { $exists: true },
  visibility: "public",
  hiddenAt: null,
} as const;

const PACK_FIELDS = {
  _id: 0,
  slug: 1,
  slots: 1,
  buckets: 1,
  "archive.tournament": 1,
  "archive.round": 1,
  "archive.year": 1,
  "archive.badged": 1,
  "archive.fingerprint": 1,
} as const;

const usageCollection = async () =>
  (await connectedDb()).collection<UsageDoc>(MAP_USAGE_COLLECTION);

/** The counted archive packs, all or those with any of the ids (the partial slots index). */
const countedPacks = async (ids?: readonly number[]): Promise<UsagePack[]> => {
  const filter = ids ? { ...COUNTED, "slots.beatmapId": { $in: [...ids] } } : COUNTED;
  const docs = await (await connectedDb())
    .collection("packs")
    .find<StoredUsagePack>(filter, { projection: PACK_FIELDS })
    .toArray();
  return docs.flatMap((doc) => {
    const pack = usagePackOf(doc);
    return pack ? [pack] : [];
  });
};

/** What's stored now, for the ids or for every map. */
const storedUsage = async (ids?: readonly number[]): Promise<Map<number, MapUsageEntry[]>> => {
  const docs = await (await usageCollection())
    .find(ids ? { _id: { $in: [...ids] } } : {})
    .toArray();
  return new Map(docs.map((doc) => [doc._id, storedUsageEntries(doc.entries)]));
};

export type UsageRebuild = {
  /** Beatmaps that archive pools use, in the rebuilt set. */
  beatmaps: number;
  /** Documents written (new or changed). */
  written: number;
  /** Documents removed (no counted pack uses the map any more). */
  removed: number;
};

/** A rebuild whose packs changed while it wrote goes round at most this many times. */
const MAX_REBUILD_ROUNDS = 3;

/**
 * @function rebuildMapUsage
 * @param beatmapIds {readonly number[]} the maps to rebuild; left out, every map (the importer)
 * @param now {Date} the write time (tests)
 * @param hooks {{ beforeWrite?: () => Promise<void> }} runs between the reads and the writes of
 *        each round (tests: another rebuild racing this one)
 * @returns {Promise<UsageRebuild>} what the rebuild found and wrote. Only documents whose entries
 *          change are written, so a rebuild that finds nothing new writes nothing. Two rebuilds
 *          can race (an admin hiding two packs that share a map): after writing, the packs are
 *          read again, and when they changed since the first read (so what was written may be
 *          older than another rebuild's), it goes round again, up to MAX_REBUILD_ROUNDS times.
 */
export const rebuildMapUsage = async (
  beatmapIds?: readonly number[],
  now: Date = new Date(),
  { beforeWrite }: { beforeWrite?: () => Promise<void> } = {},
): Promise<UsageRebuild> => {
  const ids = beatmapIds ? [...new Set(beatmapIds)] : undefined;
  if (ids?.length === 0) return { beatmaps: 0, written: 0, removed: 0 };
  const only = ids ? new Set(ids) : undefined;
  let next = buildMapUsage(await countedPacks(ids), only);
  let written = 0;
  let removed = 0;
  for (let round = 1; ; round++) {
    const stored = await storedUsage(ids);
    const writes = planUsageWrites(ids ?? [...stored.keys(), ...next.keys()], stored, next);
    await beforeWrite?.();
    const operations: AnyBulkWriteOperation<UsageDoc>[] = [
      ...writes.set.map(([id, entries]) => ({
        replaceOne: {
          filter: { _id: id },
          replacement: { entries, updatedAt: now },
          upsert: true,
        },
      })),
      ...writes.remove.map((id) => ({ deleteOne: { filter: { _id: id } } })),
    ];
    if (operations.length > 0) {
      await (await usageCollection()).bulkWrite(operations, { ordered: false });
    }
    written += writes.set.length;
    removed += writes.remove.length;
    const again = buildMapUsage(await countedPacks(ids), only);
    if (sameUsage(again, next) || round >= MAX_REBUILD_ROUNDS) {
      return { beatmaps: next.size, written, removed };
    }
    next = again;
  }
};

/**
 * @function refreshMapUsage
 * @param beatmapIds {readonly number[]} the maps an archive pack change touched
 * @returns {Promise<void>} rebuilds them; a failure is logged, never thrown, so the change that
 *          called it still succeeds (the importer's next full rebuild repairs it)
 */
export const refreshMapUsage = async (beatmapIds: readonly number[]): Promise<void> => {
  try {
    await rebuildMapUsage(beatmapIds);
  } catch (error) {
    console.error("map usage: couldn't rebuild", error);
  }
};

/**
 * @function getMapUsage
 * @param beatmapIds {readonly number[]} valid beatmap ids, each once
 * @returns {Promise<BeatmapUsage[]>} each id's usage in the order asked (count 0 and no entries
 *          for a map no archive pool used)
 */
export const getMapUsage = async (beatmapIds: readonly number[]): Promise<BeatmapUsage[]> => {
  const stored = await storedUsage(beatmapIds);
  return beatmapIds.map((id) => toBeatmapUsage(id, stored.get(id) ?? []));
};
