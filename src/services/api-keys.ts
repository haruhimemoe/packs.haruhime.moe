/**
 * @file src/services/api-keys.ts
 * @desc API keys: one per user. Create and regenerate are one atomic upsert on userId, so two
 *       tabs racing still leave exactly one key. Authentication looks the key up by its hash; an
 *       admin's key skips the saved-pack cap but gets no moderation rights. A key never acts as a
 *       system account (haruhime pools). lastUsedAt is written at most once an hour.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { LAST_USED_INTERVAL_MS } from "@/constants/api";
import { isAdminOsuId } from "@/lib/admin";
import { apiKeyPrefix, generateApiKey, hashApiKey, isApiKeyFormat } from "@/lib/api-key";
import { connectDb, getDb } from "@/lib/db";
import { getApiKeyModel } from "@/models/ApiKey";
import type { ApiKeyCreated, ApiKeyInfo } from "@/schemas/api";

/**
 * Who an API request acts as. isAdmin (ADMIN_OSU_IDS lists the owner's osu! id) only lifts the
 * saved-pack cap: a key never sees hidden packs or reaches moderation.
 */
export type ApiCaller = { id: string; osuId: number; username: string; isAdmin: boolean };

type ApiKeyRecord = { prefix: string; createdAt: Date; lastUsedAt?: Date | null };

const toApiKeyInfo = (doc: ApiKeyRecord): ApiKeyInfo => ({
  prefix: doc.prefix,
  createdAt: doc.createdAt.toISOString(),
  lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
});

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

const connectedApiKeyModel = async () => {
  await connectDb();
  const model = getApiKeyModel();
  await model.init();
  return model;
};

/**
 * @function getApiKeyInfo
 * @param userId {string} signed-in user's id
 * @returns {Promise<ApiKeyInfo | null>} prefix and dates, or null when the user has no key
 */
export const getApiKeyInfo = async (userId: string): Promise<ApiKeyInfo | null> => {
  const model = await connectedApiKeyModel();
  const doc = await model.findOne({ userId: new ObjectId(userId) }).lean();
  return doc ? toApiKeyInfo(doc) : null;
};

/**
 * @function createApiKey
 * @param userId {string} signed-in user's id
 * @param now {Date} creation time (tests)
 * @returns {Promise<ApiKeyCreated>} the new key (shown once) and its info. Replaces any old key.
 */
export const createApiKey = async (
  userId: string,
  now: Date = new Date(),
): Promise<ApiKeyCreated> => {
  const model = await connectedApiKeyModel();
  const key = generateApiKey();
  const upsert = () =>
    model
      .findOneAndUpdate(
        { userId: new ObjectId(userId) },
        {
          $set: { prefix: apiKeyPrefix(key), hash: hashApiKey(key), createdAt: now },
          $unset: { lastUsedAt: 1 },
        },
        { upsert: true, returnDocument: "after" },
      )
      .lean();
  // Two creates racing for a user with no key can both try to insert; the loser just updates.
  const doc = await upsert().catch((error: unknown) => {
    if (!isDuplicateKey(error)) throw error;
    return upsert();
  });
  if (!doc) throw new Error("api key upsert returned no document");
  return { key, apiKey: toApiKeyInfo(doc) };
};

/**
 * @function revokeApiKey
 * @param userId {string} signed-in user's id
 * @returns {Promise<boolean>} true when a key was deleted
 */
export const revokeApiKey = async (userId: string): Promise<boolean> => {
  const model = await connectedApiKeyModel();
  return (await model.deleteOne({ userId: new ObjectId(userId) })).deletedCount === 1;
};

/**
 * @function authenticateApiKey
 * @param key {string} untrusted bearer token
 * @param now {Date} current time (tests)
 * @returns {Promise<ApiCaller | null>} the key's owner, or null for a malformed, unknown, revoked,
 *          or replaced key, or one whose user record is gone or is a system account
 */
export const authenticateApiKey = async (
  key: string,
  now: Date = new Date(),
): Promise<ApiCaller | null> => {
  if (!isApiKeyFormat(key)) return null;
  const model = await connectedApiKeyModel();
  const hash = hashApiKey(key);
  const doc = await model.findOne({ hash }).lean();
  if (!doc) return null;
  const user = await getDb()
    .collection("user")
    .findOne({ _id: doc.userId }, { projection: { osuId: 1, username: 1, system: 1 } });
  if (!user || user.system === true) return null;
  if (typeof user.username !== "string" || typeof user.osuId !== "number") return null;
  if (!doc.lastUsedAt || now.getTime() - doc.lastUsedAt.getTime() >= LAST_USED_INTERVAL_MS) {
    // Filter on the hash too, so a regenerate in between isn't stamped with this use.
    await model.updateOne({ _id: doc._id, hash }, { $set: { lastUsedAt: now } });
  }
  return {
    id: doc.userId.toString(),
    osuId: user.osuId,
    username: user.username,
    isAdmin: isAdminOsuId(user.osuId),
  };
};
