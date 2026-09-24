/**
 * @file src/services/pins.ts
 * @desc Pinned packs, for admins: pin, unpin, reorder, and the pinned list in order (the
 *       "Pinned" row on /packs reads the same pins through src/services/public-packs.ts). The
 *       rules come from src/utils/pins.ts: public packs that aren't hidden only, at most
 *       MAX_PINNED_PACKS, a new pin goes last. Private packs come back null, like every admin
 *       service, so routes answer 404. Writes go through the driver so `updatedAt` never moves,
 *       and each one that changes a pin marks the cached /packs stale. Hiding a pack
 *       (services/moderation.ts) or saving it away from public (services/packs.ts) unsets its
 *       pin in the same write.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { UNKNOWN_OWNER_NAME } from "@/constants/api";
import { revalidatePublicPacks } from "@/lib/revalidate";
import { UNPIN } from "@/models/Pack";
import { type PinnedPack, pinnedPackSchema } from "@/schemas/public-pack";
import { slugSchema } from "@/schemas/saved-pack";
import { MODERATED } from "@/services/moderation";
import { connectedPackModel } from "@/services/packs";
import {
  isOverPinLimit,
  isSamePinSet,
  nextPinOrder,
  PIN_LIMIT,
  PINS_CHANGED,
  pinRefusal,
} from "@/utils/pins";

/** A pin the rules refuse; the message says why, for the admin to read. */
export class PinRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PinRefusedError";
  }
}

/** Every pinned pack. `$exists`, not `$ne: null`, so the partial index on pinOrder applies. */
export const PINNED = { pinnedAt: { $exists: true } } as const;

/** Pin order; packs that share an order (two pins at once) fall back to when they were pinned. */
export const PIN_SORT = { pinOrder: 1, pinnedAt: 1, _id: 1 } as const;

/** What can hold a pin: public and not hidden (`hiddenAt: null` also matches a missing field). */
const PINNABLE = { visibility: "public", hiddenAt: null } as const;

type PinnedRow = { slug: string; name: string; pinnedAt: Date; ownerName: string };

/**
 * @function listPinnedForAdmin
 * @returns {Promise<PinnedPack[]>} every pinned pack in pin order, with the host's name (or
 *          UNKNOWN_OWNER_NAME when the host's record is gone, so it can still be unpinned)
 */
export const listPinnedForAdmin = async (): Promise<PinnedPack[]> => {
  const model = await connectedPackModel();
  const rows = await model.aggregate<PinnedRow>([
    { $match: PINNED },
    { $sort: PIN_SORT },
    { $lookup: { from: "user", localField: "ownerId", foreignField: "_id", as: "owner" } },
    { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        slug: 1,
        name: 1,
        pinnedAt: 1,
        ownerName: {
          $cond: [
            { $eq: [{ $type: "$owner.username" }, "string"] },
            "$owner.username",
            UNKNOWN_OWNER_NAME,
          ],
        },
      },
    },
  ]);
  return rows.map((row) =>
    pinnedPackSchema.parse({ ...row, pinnedAt: row.pinnedAt.toISOString() }),
  );
};

/**
 * @function isPackPinned
 * @param slug {string} untrusted route segment
 * @returns {Promise<boolean>} true when the pack is pinned
 */
export const isPackPinned = async (slug: string): Promise<boolean> => {
  if (!slugSchema.safeParse(slug).success) return false;
  const model = await connectedPackModel();
  return (await model.collection.findOne({ slug, ...PINNED }, { projection: { _id: 1 } })) !== null;
};

/**
 * @function pinPack
 * @param slug {string} untrusted route segment
 * @returns {Promise<PinnedPack[] | null>} the pinned list with this pack last (a pack that was
 *          pinned already keeps its place); null when missing, malformed, or private
 * @throws {PinRefusedError} when the pack isn't public, is hidden, or MAX_PINNED_PACKS are
 *         pinned already (a pin that finds the limit passed once written backs out)
 */
export const pinPack = async (slug: string): Promise<PinnedPack[] | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  // A second pass only when the pack changed between the read and the write.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const pack = await model.collection.findOne(
      { slug, ...MODERATED },
      { projection: { visibility: 1, hiddenAt: 1, pinnedAt: 1 } },
    );
    if (!pack) return null;
    if (pack.pinnedAt) return listPinnedForAdmin();
    const pinned = await model.collection.find(PINNED, { projection: { pinOrder: 1 } }).toArray();
    const refusal = pinRefusal(
      { visibility: String(pack.visibility), hidden: Boolean(pack.hiddenAt) },
      pinned.length,
    );
    if (refusal) throw new PinRefusedError(refusal);
    const pinnedAt = new Date();
    const written = await model.collection.updateOne(
      { slug, ...PINNABLE, pinnedAt: { $exists: false } },
      { $set: { pinnedAt, pinOrder: nextPinOrder(pinned.map((pin) => pin.pinOrder)) } },
    );
    if (written.modifiedCount === 0) continue;
    // Another pin may have landed since the count: past the limit, this one backs out.
    if (isOverPinLimit(await model.collection.countDocuments(PINNED))) {
      await model.collection.updateOne({ slug, pinnedAt }, { $unset: UNPIN });
      throw new PinRefusedError(PIN_LIMIT);
    }
    revalidatePublicPacks();
    return listPinnedForAdmin();
  }
  throw new PinRefusedError(PINS_CHANGED);
};

/**
 * @function unpinPack
 * @param slug {string} untrusted route segment
 * @returns {Promise<PinnedPack[] | null>} the pinned packs left, in order (the same list when it
 *          wasn't pinned); null when missing, malformed, or private
 */
export const unpinPack = async (slug: string): Promise<PinnedPack[] | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  const result = await model.collection.updateOne({ slug, ...MODERATED }, { $unset: UNPIN });
  if (result.matchedCount === 0) return null;
  if (result.modifiedCount === 1) revalidatePublicPacks();
  return listPinnedForAdmin();
};

/**
 * @function reorderPins
 * @param slugs {readonly string[]} every pinned slug, in the new order (validated by the route)
 * @returns {Promise<PinnedPack[]>} the pinned list in its new order
 * @throws {PinRefusedError} when slugs isn't exactly the pinned packs (one was pinned or
 *         unpinned since the admin's page loaded)
 */
export const reorderPins = async (slugs: readonly string[]): Promise<PinnedPack[]> => {
  const model = await connectedPackModel();
  const current = await model.collection.find(PINNED, { projection: { slug: 1 } }).toArray();
  if (
    !isSamePinSet(
      current.map((pin) => String(pin.slug)),
      slugs,
    )
  ) {
    throw new PinRefusedError(PINS_CHANGED);
  }
  if (slugs.length > 0) {
    await model.collection.bulkWrite(
      slugs.map((slug, pinOrder) => ({
        updateOne: { filter: { slug, ...PINNED }, update: { $set: { pinOrder } } },
      })),
    );
    revalidatePublicPacks();
  }
  return listPinnedForAdmin();
};
