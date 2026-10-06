/**
 * @file src/utils/slot-sortable-ids.ts
 * @desc Ids for the pool table's sortable lists and items: `b:<code>` per bucket ("" for maps
 *       with no slot, mirroring pools' `bucketListId`) and `m:<beatmapId>` per map, unique across
 *       the whole pool. Pure, no React.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { SlotBucket } from "@/schemas/pack";

/**
 * @function bucketListId
 * @param mod {SlotBucket} a bucket, null for maps with no slot
 * @returns {string} its list's sortable container id
 */
export const bucketListId = (mod: SlotBucket): string => `b:${mod ?? ""}`;

/**
 * @function slotItemId
 * @param beatmapId {number} a slot's map
 * @returns {string} its row's sortable item id
 */
export const slotItemId = (beatmapId: number): string => `m:${beatmapId}`;

/**
 * @function beatmapIdOfItem
 * @param id {string} a sortable item id, as `slotItemId` makes it
 * @returns {number | null} the beatmap id it was made from, or null for any other id
 */
export const beatmapIdOfItem = (id: string): number | null => {
  if (!id.startsWith("m:")) return null;
  const beatmapId = Number(id.slice(2));
  return Number.isInteger(beatmapId) ? beatmapId : null;
};
