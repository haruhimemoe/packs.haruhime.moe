/**
 * @file src/services/public-packs.ts
 * @desc The public list (/packs) and its search index: public packs with no moderation flag,
 *       newest created first (an edit doesn't move a pack up; the browser can sort the index by
 *       last update), joined with the host's current osu! name from better-auth's "user"
 *       collection. Read by ISR pages, so each runs once per regeneration, not per visitor.
 *       CI builds (SKIP_ENV_VALIDATION) get empty results instead of a database. The API's page
 *       (listPublicPacksFull) lists full pack objects, most recently updated first, and keeps a
 *       pack whose owner has no username or no record (as UNKNOWN_OWNER_NAME), so its total is
 *       exact. Cards and index entries carry the pack's stats in compact form when it has them.
 *       The "Pinned" row (listPinnedPacks) is the same cards for the packs admins pinned, in pin
 *       order.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { PipelineStage } from "mongoose";
import { UNKNOWN_OWNER_NAME } from "@/constants/api";
import { DESCRIPTION_EXCERPT_LENGTH } from "@/constants/pack";
import { MAX_PINNED_PACKS, PUBLIC_PAGE_SIZE, SEARCH_INDEX_LIMIT } from "@/constants/public-packs";
import { isEnvValidationSkipped } from "@/env";
import type { IndexStats } from "@/schemas/pack-stats";
import {
  type PublicPackCard,
  type PublicPackPage,
  publicPackCardSchema,
  type SearchIndex,
  searchIndexSchema,
} from "@/schemas/public-pack";
import type { SavedPack } from "@/schemas/saved-pack";
import { connectedPackModel, type PackRecord, storedStats, toSavedPack } from "@/services/packs";
import { PIN_SORT, PINNED } from "@/services/pins";
import { toIndexStats } from "@/utils/saved-pack-stats";
import { excerpt } from "@/utils/text";

/** On /packs: public and not hidden (`hiddenAt: null` also matches a missing field). */
const LISTED = { visibility: "public", hiddenAt: null };

type ListedRow = {
  slug: string;
  name: string;
  description?: string | null;
  slotCount: number;
  createdAt: Date;
  updatedAt: Date;
  stats?: PackRecord["stats"];
  owner: { username: string; avatarUrl?: string | null };
};

/** Host and card fields. Packs whose owner record is gone drop out at $unwind. */
const cardStages: PipelineStage[] = [
  { $lookup: { from: "user", localField: "ownerId", foreignField: "_id", as: "owner" } },
  { $unwind: "$owner" },
  {
    $project: {
      _id: 0,
      slug: 1,
      name: 1,
      description: 1,
      createdAt: 1,
      updatedAt: 1,
      stats: 1,
      slotCount: { $size: "$slots" },
      owner: { username: "$owner.username", avatarUrl: "$owner.avatarUrl" },
    },
  },
];

/** Newest created first. */
const listedStages = (skip: number, limit: number): PipelineStage[] => [
  { $match: LISTED },
  { $sort: { createdAt: -1, _id: -1 } },
  { $skip: skip },
  { $limit: limit },
  ...cardStages,
];

const describe = (row: ListedRow): string =>
  excerpt(row.description ?? "", DESCRIPTION_EXCERPT_LENGTH);

/** The row's stats in the compact card and index form, or nothing when it has none. */
const compactStats = (row: ListedRow): { stats?: IndexStats } => {
  const stats = storedStats(row.stats);
  return stats ? { stats: toIndexStats(stats) } : {};
};

const toCard = (row: ListedRow): PublicPackCard =>
  publicPackCardSchema.parse({
    slug: row.slug,
    name: row.name,
    ownerName: row.owner.username,
    ownerAvatarUrl: row.owner.avatarUrl ?? null,
    slotCount: row.slotCount,
    excerpt: describe(row),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    ...compactStats(row),
  });

/**
 * @function listPublicPacks
 * @param page {number} 1-based page
 * @returns {Promise<PublicPackPage>} up to PUBLIC_PAGE_SIZE cards, the page count (at least 1),
 *          and the total
 */
export const listPublicPacks = async (page: number): Promise<PublicPackPage> => {
  if (isEnvValidationSkipped()) return { packs: [], page, pageCount: 1, total: 0 };
  const model = await connectedPackModel();
  const total = await model.collection.countDocuments(LISTED);
  const pageCount = Math.max(1, Math.ceil(total / PUBLIC_PAGE_SIZE));
  // Past the end: the page 404s anyway, so skip the (large-$skip) aggregate.
  if (page > pageCount) return { packs: [], page, pageCount, total };
  const rows = await model.aggregate<ListedRow>(
    listedStages((page - 1) * PUBLIC_PAGE_SIZE, PUBLIC_PAGE_SIZE),
  );
  return { packs: rows.map(toCard), page, pageCount, total };
};

/**
 * @function listPinnedPacks
 * @returns {Promise<PublicPackCard[]>} the packs admins pinned, in pin order, as the same cards
 *          the list shows: public and not hidden only (the pin services keep it that way; the
 *          filter makes sure), at most MAX_PINNED_PACKS
 */
export const listPinnedPacks = async (): Promise<PublicPackCard[]> => {
  if (isEnvValidationSkipped()) return [];
  const model = await connectedPackModel();
  const rows = await model.aggregate<ListedRow>([
    { $match: { ...PINNED, ...LISTED } },
    { $sort: PIN_SORT },
    { $limit: MAX_PINNED_PACKS },
    ...cardStages,
  ]);
  return rows.map(toCard);
};

/**
 * @function buildSearchIndex
 * @param options {{ limit?: number }} most packs to include (default SEARCH_INDEX_LIMIT)
 * @returns {Promise<SearchIndex>} the newest created public packs in the compact index shape
 */
export const buildSearchIndex = async ({
  limit = SEARCH_INDEX_LIMIT,
}: {
  limit?: number;
} = {}): Promise<SearchIndex> => {
  if (isEnvValidationSkipped()) return { v: 1, packs: [] };
  const model = await connectedPackModel();
  const rows = await model.aggregate<ListedRow>(listedStages(0, limit));
  return searchIndexSchema.parse({
    v: 1,
    packs: rows.map((row) => ({
      s: row.slug,
      n: row.name,
      o: row.owner.username,
      c: row.slotCount,
      d: describe(row),
      u: row.updatedAt.toISOString(),
      t: row.createdAt.toISOString(),
      ...compactStats(row).stats,
    })),
  });
};

/**
 * @function listPublicPacksFull
 * @param page {number} 1-based page
 * @param pageSize {number} packs per page
 * @returns {Promise<{ packs: { pack: SavedPack; ownerName: string }[]; page; pageCount; total }>}
 *          the packs /packs lists, most recently updated first, as full DTOs (the API). Past the
 *          end: no packs.
 */
export const listPublicPacksFull = async (
  page: number,
  pageSize: number,
): Promise<{
  packs: { pack: SavedPack; ownerName: string }[];
  page: number;
  pageCount: number;
  total: number;
}> => {
  const model = await connectedPackModel();
  const total = await model.collection.countDocuments(LISTED);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (page > pageCount) return { packs: [], page, pageCount, total };
  const rows = await model.aggregate<PackRecord & { ownerName: string }>([
    { $match: LISTED },
    { $sort: { updatedAt: -1, _id: -1 } },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
    { $lookup: { from: "user", localField: "ownerId", foreignField: "_id", as: "owner" } },
    { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        ownerName: {
          $cond: [
            { $eq: [{ $type: "$owner.username" }, "string"] },
            "$owner.username",
            UNKNOWN_OWNER_NAME,
          ],
        },
      },
    },
    { $project: { owner: 0 } },
  ]);
  return {
    packs: rows.map((row) => ({ pack: toSavedPack(row), ownerName: row.ownerName })),
    page,
    pageCount,
    total,
  };
};
