/**
 * @file src/schemas/account-export.ts
 * @desc "Download my data" (GET /api/me/export): the file's shape. An allow-list: z.object strips
 *       every key it doesn't name, so the synthetic email and the API key's hash can never reach
 *       the file even if a stored record gains them. Sessions and the osu! link are the
 *       haruhime.moe account's, not packs', so they aren't in it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import { apiKeyInfoSchema } from "@/schemas/api";
import { savedPackSchema } from "@/schemas/saved-pack";

export const accountExportUserSchema = z.object({
  id: z.string(),
  osuId: z.number().int().positive(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  country: z.string().nullable(),
  createdAt: z.string(),
});

export const accountExportSchema = z.object({
  exportedAt: z.string(),
  user: accountExportUserSchema,
  packs: z.array(savedPackSchema),
  /** The API key's prefix and dates (never the key or its hash); null without one. */
  apiKey: apiKeyInfoSchema.nullable(),
});

export type AccountExport = z.infer<typeof accountExportSchema>;
