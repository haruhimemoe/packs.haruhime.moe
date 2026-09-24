/**
 * @file src/schemas/account-export.ts
 * @desc "Download my data" (GET /api/me/export): the file's shape. An allow-list: z.object strips
 *       every key it doesn't name, so session tokens, OAuth tokens (the linked account's included), the synthetic email, and the
 *       API key's hash can never reach the file even if a stored record gains them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
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

/** The record linking the account to osu! (provider, osu! user id, granted scope). Never its tokens. */
export const accountExportLinkSchema = z.object({
  provider: z.string(),
  accountId: z.string(),
  scope: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** One stored sign-in session. IP and User-Agent are null when none was recorded. */
export const accountExportSessionSchema = z.object({
  createdAt: z.string(),
  expiresAt: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
});

export const accountExportSchema = z.object({
  exportedAt: z.string(),
  user: accountExportUserSchema,
  accounts: z.array(accountExportLinkSchema),
  sessions: z.array(accountExportSessionSchema),
  packs: z.array(savedPackSchema),
  /** The API key's prefix and dates (never the key or its hash); null without one. */
  apiKey: apiKeyInfoSchema.nullable(),
});

export type AccountExport = z.infer<typeof accountExportSchema>;
