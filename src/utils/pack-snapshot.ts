/**
 * @file src/utils/pack-snapshot.ts
 * @desc What a pack's history keeps: name, description, the full bucket list and every slot, as
 *       plain JSON. A pack may hold the same map in two slots (only `(mod, index)` is unique), so
 *       a snapshot slot carries a `key` unique within the pack: the beatmap id, then `<id>#2`,
 *       `<id>#3` for later copies in slot order. PACK_CODEC keys slots and buckets by those, so
 *       diffValue and mergeValue never see a duplicate key. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { type BucketEntry, bucketsOf } from "@haruhimemoe/pool";
import { type Codec, defineCodec } from "@haruhimemoe/vcs/json";
import type { PoolSlot } from "@/schemas/pack";

/** A slot in a pack snapshot: the slot plus a key unique within the pack. */
export type SnapshotSlot = PoolSlot & { key: string };

/** A pack as one revision holds it: name, description, every bucket, every slot. */
export type PackSnapshot = {
  name: string;
  description: string;
  buckets: BucketEntry[];
  slots: SnapshotSlot[];
};

/** Slots by their key, buckets by code. */
export const PACK_CODEC: Codec = defineCodec({
  lists: {
    slots: (slot: SnapshotSlot) => slot.key,
    buckets: (bucket: BucketEntry) => bucket.code,
  },
});

/** The part of a saved pack (or a save's input) a snapshot is built from. */
export type SnapshotSource = {
  name: string;
  description?: string | null;
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
};

/**
 * @function snapshotOf
 * @param pack {SnapshotSource} a saved pack or a save's input
 * @returns {PackSnapshot} its snapshot (the full bucket list, keyed slots)
 */
export const snapshotOf = (pack: SnapshotSource): PackSnapshot => {
  const seen = new Map<number, number>();
  return {
    name: pack.name,
    description: pack.description ?? "",
    buckets: structuredClone([...bucketsOf(pack)]),
    slots: pack.slots.map(({ mod, index, beatmapId }) => {
      const copy = (seen.get(beatmapId) ?? 0) + 1;
      seen.set(beatmapId, copy);
      return {
        mod,
        index,
        beatmapId,
        key: copy === 1 ? String(beatmapId) : `${beatmapId}#${copy}`,
      };
    }),
  };
};
