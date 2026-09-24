/**
 * @file src/models/ApiKey.ts
 * @desc API key model (collection "api_keys"): one per user. Only the SHA-256 hash and a display
 *       prefix are stored, never the key. Revoking deletes the document.
 *       Registered lazily on the shared connection so importing it needs no env.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { type Connection, Schema } from "mongoose";
import { getModelConnection } from "@/lib/db";

const apiKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    prefix: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    createdAt: { type: Date, required: true },
    // Written at most once an hour (LAST_USED_INTERVAL_MS). Absent = never used.
    lastUsedAt: { type: Date },
  },
  { collection: "api_keys", versionKey: false },
);

const register = (connection: Connection) => connection.model("ApiKey", apiKeySchema);

type ApiKeyModel = ReturnType<typeof register>;

/**
 * @function getApiKeyModel
 * @returns {ApiKeyModel} the ApiKey model on the shared connection (registered once)
 */
export const getApiKeyModel = (): ApiKeyModel => {
  const connection = getModelConnection();
  return (connection.models.ApiKey as ApiKeyModel | undefined) ?? register(connection);
};
