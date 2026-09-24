/**
 * @file src/schemas/public-pack.ts
 * @desc Shapes for the public list (/packs cards), its search index (/packs/index.json), the
 *       admin table and moderation body, and pinned packs (the admin's list and the reorder
 *       body). Cards and index entries carry a pack's stats in the compact form
 *       (src/schemas/pack-stats.ts) when it has them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import { MAX_PINNED_PACKS } from "@/constants/public-packs";
import { indexStatsSchema } from "@/schemas/pack-stats";
import { slugSchema, visibilitySchema } from "@/schemas/saved-pack";

export const publicPackCardSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  ownerName: z.string(),
  ownerAvatarUrl: z.string().nullable(),
  slotCount: z.number().int().nonnegative(),
  excerpt: z.string(),
  updatedAt: z.string(),
  /** When the pack was first saved. Absent only for cards from an index cached before `t`. */
  createdAt: z.string().optional(),
  /** Absent until the pack's stats are computed. */
  stats: indexStatsSchema.optional(),
});

export type PublicPackCard = z.infer<typeof publicPackCardSchema>;

export type PublicPackPage = {
  packs: PublicPackCard[];
  page: number;
  pageCount: number;
  total: number;
};

/**
 * Short keys keep the index small: slug, name, owner, count, description excerpt, updated,
 * created, then the pack's stats (r, a, l, b, m, g, k; see indexStatsSchema), all left out when
 * it has none. `t` is optional so an index cached before it existed still parses.
 */
export const searchIndexEntrySchema = z.object({
  s: slugSchema,
  n: z.string(),
  o: z.string(),
  c: z.number().int().nonnegative(),
  d: z.string(),
  u: z.string(),
  t: z.string().optional(),
  ...indexStatsSchema.partial().shape,
});

export type SearchIndexEntry = z.infer<typeof searchIndexEntrySchema>;

export const searchIndexSchema = z.object({
  v: z.literal(1),
  packs: z.array(searchIndexEntrySchema),
});

export type SearchIndex = z.infer<typeof searchIndexSchema>;

export const adminPackRowSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  ownerName: z.string(),
  /** Null for a system account's pack (haruhime pools): it has no osu! profile. */
  ownerOsuId: z.number().int().positive().nullable(),
  visibility: visibilitySchema.exclude(["private"]),
  slotCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
  hiddenAt: z.string().nullable(),
  /** When an admin pinned it to the top of /packs; null when it isn't pinned. */
  pinnedAt: z.string().nullable(),
});

export type AdminPackRow = z.infer<typeof adminPackRowSchema>;

export type AdminPackPage = {
  rows: AdminPackRow[];
  page: number;
  pageCount: number;
  total: number;
};

/** Body of PATCH /api/admin/packs/{slug}. */
export const moderationBodySchema = z.object({ hidden: z.boolean() });

/** One pinned pack in the admin's list, which is in pin order. */
export const pinnedPackSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  ownerName: z.string(),
  pinnedAt: z.string(),
});

export type PinnedPack = z.infer<typeof pinnedPackSchema>;

/** Body of PUT /api/admin/pins: every pinned slug, in the new order. */
export const pinOrderBodySchema = z.object({
  slugs: z
    .array(slugSchema)
    .max(MAX_PINNED_PACKS, `At most ${MAX_PINNED_PACKS} packs can be pinned.`),
});
