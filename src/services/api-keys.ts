/**
 * @file src/services/api-keys.ts
 * @desc API keys: one per user, via @haruhimemoe/next-kit's store (src/lib/api-keys.ts).
 *       Authentication adds the user lookup: an admin's key skips the saved-pack cap but gets no
 *       moderation rights. A key never acts as a system account (haruhime pools).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Sat Oct 3, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { isAdminOsuId } from "@/lib/admin";
import { apiKeys } from "@/lib/api-keys";
import { getDb } from "@/lib/db";
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
 * @returns {Promise<ApiCaller | null>} the owner, or null when the user record is gone or is a
 *          system account
 */
export const resolveApiCaller = async (userId: string): Promise<ApiCaller | null> => {
  const user = await getDb()
    .collection("user")
    .findOne({ _id: new ObjectId(userId) }, { projection: { osuId: 1, username: 1, system: 1 } });
  if (!user || user.system === true) return null;
  if (typeof user.username !== "string" || typeof user.osuId !== "number") return null;
  return {
    id: userId,
    osuId: user.osuId,
    username: user.username,
    isAdmin: isAdminOsuId(user.osuId),
  };
};

/**
 * @function authenticateApiKey
 * @param key {string} untrusted bearer token
 * @returns {Promise<ApiCaller | null>} the key's owner, or null for a malformed, unknown, revoked,
 *          or replaced key, or one whose user record is gone or is a system account
 */
export const authenticateApiKey = async (key: string): Promise<ApiCaller | null> => {
  const match = await apiKeys.authenticate(key);
  if (!match) return null;
  const caller = await resolveApiCaller(match.userId);
  // Stamp only a key whose owner checks out (packs' order).
  if (caller) await match.stamp();
  return caller;
};
