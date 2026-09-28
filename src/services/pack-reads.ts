/**
 * @file src/services/pack-reads.ts
 * @desc Reading saved packs: the owner's own lists (paged for /me and the APIs, or whole for an
 *       account export) and one pack for a viewer, where "not found" and "not yours" are the same
 *       null (hidden packs only for their owner and admins). Writes live in services/packs.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { OWN_PAGE_SIZE } from "@/constants/pack";
import {
  type SavedPack,
  type SavedPackSummary,
  savedPackSummarySchema,
  slugSchema,
} from "@/schemas/saved-pack";
import { connectedPackModel, toSavedPack } from "@/services/pack-records";

export type OwnPackPage = {
  packs: SavedPackSummary[];
  page: number;
  pageCount: number;
  total: number;
};

/**
 * @function listPacks
 * @param ownerId {string} signed-in user's id
 * @param page {number} 1-based page (a page past the end is empty)
 * @returns {Promise<OwnPackPage>} OWN_PAGE_SIZE of the owner's packs, most recently updated
 *          first, with the page count (at least 1) and the owner's total
 */
export const listPacks = async (ownerId: string, page = 1): Promise<OwnPackPage> => {
  const model = await connectedPackModel();
  const [docs, total] = await Promise.all([
    model
      .find({ ownerId }, { slug: 1, name: 1, visibility: 1, updatedAt: 1, slots: 1, hiddenAt: 1 })
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * OWN_PAGE_SIZE)
      .limit(OWN_PAGE_SIZE)
      .lean(),
    model.countDocuments({ ownerId }),
  ]);
  const packs = docs.map((doc) =>
    savedPackSummarySchema.parse({
      slug: doc.slug,
      name: doc.name,
      slotCount: doc.slots.length,
      visibility: doc.visibility,
      ...(doc.hiddenAt ? { hidden: true } : {}),
      updatedAt: doc.updatedAt.toISOString(),
    }),
  );
  return { packs, page, pageCount: Math.max(1, Math.ceil(total / OWN_PAGE_SIZE)), total };
};

/**
 * @function listSavedPacks
 * @param ownerId {string} signed-in user's id
 * @returns {Promise<SavedPack[]>} every pack the owner saved as full DTOs: any visibility,
 *          moderator-hidden ones included (with hiddenAt), most recently updated first
 */
export const listSavedPacks = async (ownerId: string): Promise<SavedPack[]> => {
  const model = await connectedPackModel();
  const docs = await model.find({ ownerId }).sort({ updatedAt: -1, _id: -1 }).lean();
  return docs.map((doc) => toSavedPack(doc));
};

/**
 * @function listSavedPackPage
 * @param ownerId {string} the owner's user id
 * @param page {number} 1-based page (a page past the end is empty)
 * @param pageSize {number} packs per page
 * @returns {Promise<{ packs: SavedPack[]; page: number; pageCount: number; total: number }>}
 *          one page of listSavedPacks' order, with the page count (at least 1) and the total
 */
export const listSavedPackPage = async (
  ownerId: string,
  page: number,
  pageSize: number,
): Promise<{ packs: SavedPack[]; page: number; pageCount: number; total: number }> => {
  const model = await connectedPackModel();
  const [docs, total] = await Promise.all([
    model
      .find({ ownerId })
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    model.countDocuments({ ownerId }),
  ]);
  return {
    packs: docs.map((doc) => toSavedPack(doc)),
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
};

/** The one copy of "who may see this pack": private and hidden packs only for their owner. */
const findVisiblePack = async (slug: string, viewerId: string | null, isAdmin: boolean) => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  const doc = await model.findOne({ slug }).lean();
  if (!doc) return null;
  const isOwner = viewerId !== null && doc.ownerId.toString() === viewerId;
  if (doc.visibility === "private" && !isOwner) return null;
  if (doc.hiddenAt && !isOwner && !isAdmin) return null;
  return { doc, isOwner };
};

/**
 * @function getPackForViewer
 * @param slug {string} untrusted route segment
 * @param viewerId {string | null} signed-in user's id, or null when anonymous
 * @param options {{ isAdmin?: boolean }} admins also see hidden public/unlisted packs
 * @returns {Promise<{ pack: SavedPack; isOwner: boolean } | null>} null when missing, private to
 *          someone else, or hidden from this viewer
 */
export const getPackForViewer = async (
  slug: string,
  viewerId: string | null,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): Promise<{ pack: SavedPack; isOwner: boolean } | null> => {
  const found = await findVisiblePack(slug, viewerId, isAdmin);
  return found ? { pack: toSavedPack(found.doc), isOwner: found.isOwner } : null;
};

/**
 * @function getPackWithOwner
 * @param slug {string} untrusted route segment
 * @param viewerId {string | null} the API caller's user id
 * @returns {Promise<{ pack: SavedPack; isOwner: boolean; ownerId: string } | null>} same rules
 *          as getPackForViewer without admin rights (API keys never carry them)
 */
export const getPackWithOwner = async (
  slug: string,
  viewerId: string | null,
): Promise<{ pack: SavedPack; isOwner: boolean; ownerId: string } | null> => {
  const found = await findVisiblePack(slug, viewerId, false);
  return found
    ? {
        pack: toSavedPack(found.doc),
        isOwner: found.isOwner,
        ownerId: found.doc.ownerId.toString(),
      }
    : null;
};
