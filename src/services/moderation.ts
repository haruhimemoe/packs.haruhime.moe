/**
 * @file src/services/moderation.ts
 * @desc Admin moderation over public and unlisted packs: list (with a hidden filter and a literal
 *       name filter), hide, unhide, delete. Private packs are never listed or touched. Removing
 *       one magnet link lives with the owner's remove in src/services/pack-exports.ts. Moderation
 *       writes go through the driver so `updatedAt` never moves (a hidden pack keeps its place).
 *       Hiding a pack also unpins it (pins live in src/services/pins.ts); unhiding never pins it
 *       again. Rows say when a pack was pinned. The haruhime pools account's packs (a system
 *       account with no osu! id) are moderated like any other. Deleting a pack pools.haruhime.moe
 *       published writes a tombstone of its pool first (src/services/pools-sync.ts), then deletes
 *       it, so no sync creates it again.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { type Document, ObjectId } from "mongodb";
import type { PipelineStage } from "mongoose";
import { ADMIN_PAGE_SIZE } from "@/constants/public-packs";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import { UNPIN } from "@/models/Pack";
import { type AdminPackPage, type AdminPackRow, adminPackRowSchema } from "@/schemas/public-pack";
import { slugSchema, type Visibility } from "@/schemas/saved-pack";
import { connectedPackModel } from "@/services/packs";
import { tombstoneOrigin } from "@/services/pools-sync";
import { escapeRegExp } from "@/utils/text";

/** What admins moderate: anything others can reach. */
export const MODERATED: { visibility: { $in: Visibility[] } } = {
  visibility: { $in: ["public", "unlisted"] },
};

type AdminRecord = {
  slug: string;
  name: string;
  visibility: string;
  slotCount: number;
  updatedAt: Date;
  hiddenAt?: Date | null;
  pinnedAt?: Date | null;
  /** No osu! id on a system account (haruhime pools). */
  owner: { username: string; osuId?: number | null };
};

const ownerStages: PipelineStage[] = [
  { $lookup: { from: "user", localField: "ownerId", foreignField: "_id", as: "owner" } },
  { $unwind: "$owner" },
  {
    $project: {
      _id: 0,
      slug: 1,
      name: 1,
      visibility: 1,
      updatedAt: 1,
      hiddenAt: 1,
      pinnedAt: 1,
      slotCount: { $size: "$slots" },
      owner: { username: "$owner.username", osuId: "$owner.osuId" },
    },
  },
];

const toRow = (record: AdminRecord): AdminPackRow =>
  adminPackRowSchema.parse({
    slug: record.slug,
    name: record.name,
    ownerName: record.owner.username,
    ownerOsuId: record.owner.osuId ?? null,
    visibility: record.visibility,
    slotCount: record.slotCount,
    updatedAt: record.updatedAt.toISOString(),
    hiddenAt: record.hiddenAt ? record.hiddenAt.toISOString() : null,
    pinnedAt: record.pinnedAt ? record.pinnedAt.toISOString() : null,
  });

export type AdminListOptions = { page?: number; hiddenOnly?: boolean; query?: string };

/**
 * @function listPacksForAdmin
 * @param options {AdminListOptions} 1-based page, hidden-only filter, case-insensitive name text
 * @returns {Promise<AdminPackPage>} up to ADMIN_PAGE_SIZE rows, newest update first
 */
export const listPacksForAdmin = async ({
  page = 1,
  hiddenOnly = false,
  query = "",
}: AdminListOptions = {}): Promise<AdminPackPage> => {
  const model = await connectedPackModel();
  const text = query.trim();
  const filter: Document = {
    ...MODERATED,
    ...(hiddenOnly ? { hiddenAt: { $ne: null } } : {}),
    ...(text ? { name: { $regex: escapeRegExp(text), $options: "i" } } : {}),
  };
  const total = await model.collection.countDocuments(filter);
  const records = await model.aggregate<AdminRecord>([
    { $match: filter },
    { $sort: { updatedAt: -1, _id: -1 } },
    { $skip: (page - 1) * ADMIN_PAGE_SIZE },
    { $limit: ADMIN_PAGE_SIZE },
    ...ownerStages,
  ]);
  return {
    rows: records.map(toRow),
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    total,
  };
};

/**
 * @function setPackHidden
 * @param slug {string} untrusted route segment
 * @param adminId {string} the moderating admin's user id
 * @param hidden {boolean} hide (true, which also unpins it) or unhide (false)
 * @returns {Promise<AdminPackRow | null>} the updated row; null when missing, malformed, or private
 */
export const setPackHidden = async (
  slug: string,
  adminId: string,
  hidden: boolean,
): Promise<AdminPackRow | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  // Hiding an already hidden pack keeps the first hide's date and moderator. A hidden pack
  // can't stay pinned, so the hide takes the pin away in the same write.
  const result = await model.collection.updateOne(
    (hidden
      ? { slug, ...MODERATED, hiddenAt: { $exists: false } }
      : { slug, ...MODERATED }) as Document,
    hidden
      ? { $set: { hiddenAt: new Date(), hiddenBy: new ObjectId(adminId) }, $unset: UNPIN }
      : { $unset: { hiddenAt: "", hiddenBy: "" } },
  );
  if (result.matchedCount === 0 && !(await model.collection.findOne({ slug, ...MODERATED }))) {
    return null;
  }
  revalidatePack(slug);
  revalidatePublicPacks();
  const [record] = await model.aggregate<AdminRecord>([{ $match: { slug } }, ...ownerStages]);
  return record ? toRow(record) : null;
};

/**
 * @function adminDeletePack
 * @param slug {string} untrusted route segment
 * @returns {Promise<boolean>} true when a public or unlisted pack was deleted
 * @throws when the database fails; a pack whose tombstone couldn't be written is still there
 */
export const adminDeletePack = async (slug: string): Promise<boolean> => {
  if (!slugSchema.safeParse(slug).success) return false;
  const model = await connectedPackModel();
  const found = await model.collection.findOne(
    { slug, ...MODERATED },
    { projection: { _id: 1, origin: 1 } },
  );
  if (!found) return false;
  // Tombstone first: a sync that creates the pack again after this delete finds it
  // (src/services/pools-sync.ts), and a failed write leaves the pack in place, not gone untracked.
  const originId = (found as { origin?: { id?: unknown } }).origin?.id;
  if (typeof originId === "string") await tombstoneOrigin(originId);
  const { deletedCount } = await model.collection.deleteOne({ _id: found._id, ...MODERATED });
  if (deletedCount === 0) return false;
  revalidatePack(slug);
  revalidatePublicPacks();
  return true;
};
