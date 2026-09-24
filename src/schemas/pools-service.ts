/**
 * @file src/schemas/pools-service.ts
 * @desc What pools.haruhime.moe sends packs' service route and what it gets back: a pools pool id
 *       (the route's `ref`), the PUT body (exactly a pack input: name, description, visibility,
 *       slots, buckets; unknown keys refused, visibility required), and the answer.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import { POOLS_REF_PATTERN } from "@/constants/pools";
import { packInputSchema, visibilitySchema } from "@/schemas/saved-pack";

export const poolsRefSchema = z.string().regex(POOLS_REF_PATTERN);

/**
 * The PUT body: a strict object first, so a key a pack input doesn't have is a 400 instead of
 * being dropped, and visibility is required instead of defaulting to unlisted; then
 * packInputSchema itself, with every limit, the content filter and the bucket checks.
 */
export const poolsPackBodySchema = z
  .strictObject({
    name: z.unknown().optional(),
    description: z.unknown().optional(),
    visibility: visibilitySchema.optional(),
    slots: z.unknown().optional(),
    buckets: z.unknown().optional(),
  })
  .refine((body) => body.visibility !== undefined, {
    message: "Send visibility: public or unlisted.",
    path: ["visibility"],
  })
  .pipe(packInputSchema);

export const POOLS_SYNC_STATES = ["created", "updated", "unchanged"] as const;

export const poolsSyncAnswerSchema = z.object({
  slug: z.string(),
  state: z.enum(POOLS_SYNC_STATES),
  /** False when a moderator hid the pack or it's unlisted. */
  listed: z.boolean(),
});

export type PoolsSyncAnswer = z.infer<typeof poolsSyncAnswerSchema>;
