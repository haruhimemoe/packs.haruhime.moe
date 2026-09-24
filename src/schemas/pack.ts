/**
 * @file src/schemas/pack.ts
 * @desc Pack identity: the pool shape and schemas from @haruhimemoe/pool (name, slots, and the
 *       bucket list; no beatmap metadata), re-exported so packs code imports them from one place.
 *       A slot's `mod` is a bucket code or null (no slot); `buckets` is omitted when it is the six
 *       built-ins in default order.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

export {
  type BucketEntry,
  beatmapIdSchema,
  type CustomBucket,
  checkPoolBuckets,
  type Pool,
  type PoolSlot,
  poolDraftSchema,
  poolFields,
  poolSchema,
  poolSlotSchema,
  type SlotBucket,
  type StoredSlotMods,
  slotKey,
  storedSlotModsSchema,
} from "@haruhimemoe/pool";
