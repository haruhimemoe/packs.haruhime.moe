/**
 * @file src/lib/api-key.ts
 * @desc API key primitives: generate (hpk_ + 32 random bytes, base64url), SHA-256 hash (the only
 *       thing stored), display prefix, format check, and the Bearer header parser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { API_KEY_BYTES, API_KEY_DISPLAY_LENGTH, API_KEY_PREFIX } from "@/constants/api";

const KEY_PATTERN = new RegExp(
  `^${API_KEY_PREFIX}[A-Za-z0-9_-]{${Math.ceil((API_KEY_BYTES * 4) / 3)}}$`,
);
const BEARER = /^Bearer[ \t]+(\S+)$/i;

/**
 * @function generateApiKey
 * @returns {string} a new key; show it once and store only hashApiKey(key)
 */
export const generateApiKey = (): string =>
  `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString("base64url")}`;

/**
 * @function hashApiKey
 * @param key {string} a full key
 * @returns {string} its SHA-256 hex digest
 */
export const hashApiKey = (key: string): string =>
  createHash("sha256").update(key, "utf8").digest("hex");

/**
 * @function apiKeyPrefix
 * @param key {string} a full key
 * @returns {string} its first API_KEY_DISPLAY_LENGTH characters, for display
 */
export const apiKeyPrefix = (key: string): string => key.slice(0, API_KEY_DISPLAY_LENGTH);

/**
 * @function isApiKeyFormat
 * @param value {string} untrusted token
 * @returns {boolean} true only for hpk_ + 43 base64url characters
 */
export const isApiKeyFormat = (value: string): boolean => KEY_PATTERN.test(value);

/**
 * @function bearerToken
 * @param headers {Headers} request headers
 * @returns {string | null} the token after "Bearer " (any case, extra spaces ignored), or null
 *          when there is no single-token Bearer header
 */
export const bearerToken = (headers: Headers): string | null =>
  BEARER.exec(headers.get("authorization")?.trim() ?? "")?.[1] ?? null;
