/**
 * @file src/schemas/api.ts
 * @desc JSON shapes our routes answer with. Every error, on site routes and /api/v1 alike, is
 *       { error: { code, message } }: `code` is stable for programs, `message` is for people.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { z } from "zod";
import { API_KEY_PREFIX } from "@/constants/api";
import { savedPackSchema } from "@/schemas/saved-pack";

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/** What we can show about a key after creation: never the key, never its hash. */
export const apiKeyInfoSchema = z.object({
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type ApiKeyInfo = z.infer<typeof apiKeyInfoSchema>;

/** POST /api/me/api-key: the full key, shown once. */
export const apiKeyCreatedSchema = z.object({
  key: z.string().startsWith(API_KEY_PREFIX),
  apiKey: apiKeyInfoSchema,
});

export type ApiKeyCreated = z.infer<typeof apiKeyCreatedSchema>;

export const apiUserSchema = z.object({
  id: z.string(),
  osuId: z.number().int().positive(),
  username: z.string(),
});

/** GET /api/v1/me */
export const apiMeResponseSchema = z.object({ user: apiUserSchema });

/** A pack as the API returns it: the saved-pack DTO plus its pack key and owner's name. */
export const apiPackSchema = savedPackSchema.safeExtend({
  packKey: z.string(),
  ownerName: z.string(),
});

export type ApiPack = z.infer<typeof apiPackSchema>;

/** GET/PUT /api/v1/packs/{slug}, POST /api/v1/packs */
export const apiPackResponseSchema = z.object({ pack: apiPackSchema });

/** GET /api/v1/packs and GET /api/v1/me/packs */
export const apiPackPageResponseSchema = z.object({
  packs: z.array(apiPackSchema),
  page: z.number().int().positive(),
  pageCount: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export type ApiPackPage = z.infer<typeof apiPackPageResponseSchema>;
