/**
 * @file src/schemas/public-pack.ts
 * @desc Shapes for the public list (/packs cards), its search index (/packs/index.json), and the
 *       admin table and moderation body.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { z } from "zod";
import { slugSchema, visibilitySchema } from "@/schemas/saved-pack";

export const publicPackCardSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  ownerName: z.string(),
  ownerAvatarUrl: z.string().nullable(),
  slotCount: z.number().int().nonnegative(),
  excerpt: z.string(),
  updatedAt: z.string(),
});

export type PublicPackCard = z.infer<typeof publicPackCardSchema>;

export type PublicPackPage = {
  packs: PublicPackCard[];
  page: number;
  pageCount: number;
  total: number;
};

/** Short keys keep the index small: slug, name, owner, count, description excerpt, updated. */
export const searchIndexEntrySchema = z.object({
  s: slugSchema,
  n: z.string(),
  o: z.string(),
  c: z.number().int().nonnegative(),
  d: z.string(),
  u: z.string(),
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
  ownerOsuId: z.number().int().positive(),
  visibility: visibilitySchema.exclude(["private"]),
  slotCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
  hiddenAt: z.string().nullable(),
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
