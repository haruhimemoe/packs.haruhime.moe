/**
 * @file src/schemas/pack-history.ts
 * @desc The body PUT /api/packs/[slug]/history accepts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { z } from "zod";

/** Turn a pack's history on or off for anyone who can see the pack. */
export const historyBodySchema = z.strictObject({ historyPublic: z.boolean() });

export type HistoryBody = z.infer<typeof historyBodySchema>;
