/**
 * @file src/schemas/saved-pack.ts
 * @desc Saved packs (accounts): the slug and the DTOs the API and pages pass around. What a save
 *       accepts (packInputSchema, visibilities, the description rule) is the pools and packs
 *       contract in @haruhimemoe/pool/service. Identity only; beatmap metadata is always fetched
 *       fresh. The only derived field is `stats` (filters), which the server computes and bodies
 *       never carry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { packVisibilitySchema } from "@haruhimemoe/pool/service";
import { z } from "zod";
import { SLUG_LENGTH } from "@/constants/pack";
import { checkPoolBuckets, poolFields } from "@/schemas/pack";
import { packExportsSchema } from "@/schemas/pack-export";
import { packStatsSchema } from "@/schemas/pack-stats";

/** nanoid's URL-safe alphabet, exact length. */
export const slugSchema = z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${SLUG_LENGTH}}$`));

export const savedPackSchema = poolFields
  .extend({
    slug: slugSchema,
    visibility: packVisibilitySchema,
    description: z.string().optional(),
    /** Magnet links the owner recorded, newest first. The service always sends it. */
    exports: packExportsSchema.optional(),
    /** Set when a moderator hid the pack; only its owner and admins ever receive it. */
    hiddenAt: z.string().optional(),
    /** Filter stats, once the server has computed them (a few seconds after a save). */
    stats: packStatsSchema.optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  // A corrupt stored document must fail here (the page 404s/500s cleanly), not later inside
  // encodePackKey while rendering.
  .superRefine(checkPoolBuckets);

export type SavedPack = z.infer<typeof savedPackSchema>;

export const savedPackSummarySchema = z.object({
  slug: slugSchema,
  name: z.string(),
  slotCount: z.number().int().nonnegative(),
  visibility: packVisibilitySchema,
  hidden: z.boolean().optional(),
  updatedAt: z.string(),
});

export type SavedPackSummary = z.infer<typeof savedPackSummarySchema>;
