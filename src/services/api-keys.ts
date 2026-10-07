/**
 * @file src/services/api-keys.ts
 * @desc API keys: one per user, via @haruhimemoe/next-kit's store (src/lib/api-keys.ts).
 *       resolveApiCaller is the user lookup the /api/v1 guard (src/lib/api-auth.ts) runs after the
 *       store matches a key; the guard is the only place a key is looked up. An admin's key skips
 *       the saved-pack cap but gets no moderation rights. The owner is read from the hub's
 *       identity database (read-only). A key never acts as a banned user or a system account
 *       (SYSTEM_USER_IDS, the haruhime pools account, or an identity row still marked `system`).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { isAdminOsuId } from "@/lib/admin";
import { apiKeys } from "@/lib/api-keys";
import { isSystemUserId } from "@/lib/auth";
import { connectDb, getIdentityDb } from "@/lib/db";
import type { ApiKeyCreated, ApiKeyInfo } from "@/schemas/api";

/**
 * Who an API request acts as. isAdmin (ADMIN_OSU_IDS lists the owner's osu! id) only lifts the
 * saved-pack cap: a key never sees hidden packs or reaches moderation.
 */
export type ApiCaller = { id: string; osuId: number; username: string; isAdmin: boolean };

/**
 * @function getApiKeyInfo
 * @param userId {string} signed-in user's id
 * @returns {Promise<ApiKeyInfo | null>} prefix and dates, or null when the user has no key
 */
export const getApiKeyInfo = (userId: string): Promise<ApiKeyInfo | null> => apiKeys.info(userId);

/**
 * @function createApiKey
 * @param userId {string} signed-in user's id
 * @returns {Promise<ApiKeyCreated>} the new key (shown once) and its info. Replaces any old key.
 */
export const createApiKey = (userId: string): Promise<ApiKeyCreated> => apiKeys.issue(userId);

/**
 * @function revokeApiKey
 * @param userId {string} signed-in user's id
 * @returns {Promise<boolean>} true when a key was deleted
 */
export const revokeApiKey = (userId: string): Promise<boolean> => apiKeys.revoke(userId);

/**
 * @function resolveApiCaller
 * @param userId {string} a key's owner, from apiKeys.authenticate
 * @returns {Promise<ApiCaller | null>} the owner, or null when the user record is gone, banned
 *          or a system account
 */
export const resolveApiCaller = async (userId: string): Promise<ApiCaller | null> => {
  if (!ObjectId.isValid(userId) || isSystemUserId(userId)) return null;
  await connectDb();
  const user = await getIdentityDb()
    .collection("user")
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { osuId: 1, username: 1, system: 1, bannedAt: 1 } },
    );
  if (!user || user.system === true || user.bannedAt) return null;
  if (typeof user.username !== "string" || typeof user.osuId !== "number") return null;
  return {
    id: userId,
    osuId: user.osuId,
    username: user.username,
    isAdmin: isAdminOsuId(user.osuId),
  };
};
