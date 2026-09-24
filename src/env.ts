/**
 * @file src/env.ts
 * @desc Server environment, validated with zod on first use (not at import), so `next build` and
 *       every anonymous page work without database or auth variables. SKIP_ENV_VALIDATION=true
 *       (CI) swaps missing values for placeholders nothing ever connects with. A production server
 *       refuses that when a secret would be one of these public placeholders: first use throws,
 *       and so does server start (src/instrumentation.ts). Production means VERCEL_ENV=production
 *       when VERCEL_ENV is set (so Preview deployments without auth config still start), else
 *       NODE_ENV=production; never during `next build`. The optional CRON_SECRET guards the daily
 *       stats job. It isn't part of the server env: getCronSecret reads and checks it on its own on
 *       every call, so a missing or bad value only makes the cron route refuse, never sign-in or
 *       anything else getServerEnv backs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  OSU_CLIENT_ID: z.string().regex(/^\d+$/),
  OSU_CLIENT_SECRET: z.string().min(1),
  /** osu! user ids allowed into /admin, comma-separated. Optional: no admins when unset. */
  ADMIN_OSU_IDS: z
    .string()
    .regex(/^\d+(\s*,\s*\d+)*$/)
    .optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const SERVER_ENV_KEYS = Object.keys(serverEnvSchema.shape) as (keyof ServerEnv)[];

/** Used only under SKIP_ENV_VALIDATION=true. Nothing connects with these. */
const PLACEHOLDERS: ServerEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  BETTER_AUTH_SECRET: "skip-env-validation-placeholder-secret-000",
  BETTER_AUTH_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "0",
  OSU_CLIENT_SECRET: "placeholder",
};

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

type SecretKey = "BETTER_AUTH_SECRET" | "OSU_CLIENT_SECRET" | "MONGODB_URI";
/** The variables whose placeholder, being in public source, would be a known secret. */
const SECRET_KEYS: readonly SecretKey[] = [
  "BETTER_AUTH_SECRET",
  "OSU_CLIENT_SECRET",
  "MONGODB_URI",
];
/** Set in process.env by `next build` for the whole build, prerendering included. */
const BUILD_PHASE = "phase-production-build";

/**
 * @function isProductionServer
 * @param source {Record<string, string | undefined>} usually process.env
 * @returns {boolean} false during `next build`; on Vercel (VERCEL_ENV set), true only for
 *          VERCEL_ENV=production, since Preview and Development deployments also run with
 *          NODE_ENV=production; elsewhere, true for NODE_ENV=production
 */
const isProductionServer = (source: Record<string, string | undefined>): boolean => {
  if (source.NEXT_PHASE === BUILD_PHASE) return false;
  if (source.VERCEL_ENV) return source.VERCEL_ENV === "production";
  return source.NODE_ENV === "production";
};

/**
 * @function assertNoPlaceholderSecrets
 * @param source {Record<string, string | undefined>} usually process.env
 * @param keys {readonly SecretKey[]} the secrets this caller would use (default: all three)
 * @returns {void} nothing unless SKIP_ENV_VALIDATION=true on a production server (VERCEL_ENV
 *          production, or NODE_ENV production off Vercel; never during `next build`) with one of
 *          those secrets missing or equal to its placeholder
 * @throws {EnvError} naming (never printing) each such secret
 */
export const assertNoPlaceholderSecrets = (
  source: Record<string, string | undefined>,
  keys: readonly SecretKey[] = SECRET_KEYS,
): void => {
  if (source.SKIP_ENV_VALIDATION !== "true") return;
  if (!isProductionServer(source)) return;
  const placeholders = keys.filter((key) => {
    const value = source[key]?.trim();
    return !value || value === PLACEHOLDERS[key];
  });
  if (placeholders.length === 0) return;
  throw new EnvError(
    `SKIP_ENV_VALIDATION is set on a production server, so ${placeholders.join(", ")} would fall back to public placeholders. Set the real values and unset SKIP_ENV_VALIDATION.`,
  );
};

/**
 * @function parseServerEnv
 * @param source {Record<string, string | undefined>} usually process.env
 * @returns {ServerEnv} the server variables, trimmed
 * @throws {EnvError} naming (never printing) each missing or invalid variable, or (skip flag on a
 *         production server) each secret that would be a placeholder
 */
export const parseServerEnv = (source: Record<string, string | undefined>): ServerEnv => {
  const present: Partial<Record<keyof ServerEnv, string>> = {};
  for (const key of SERVER_ENV_KEYS) {
    const value = source[key]?.trim();
    if (value) present[key] = value;
  }
  if (source.SKIP_ENV_VALIDATION === "true") {
    assertNoPlaceholderSecrets(source);
    return { ...PLACEHOLDERS, ...present };
  }

  const parsed = serverEnvSchema.safeParse(present);
  if (parsed.success) return parsed.data;
  const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  throw new EnvError(
    `Missing or invalid environment variables: ${names.join(", ")}. See .env.example.`,
  );
};

const databaseEnvSchema = serverEnvSchema.pick({ MONGODB_URI: true });

/**
 * @function parseDatabaseEnv
 * @param source {Record<string, string | undefined>} usually process.env
 * @returns {{ MONGODB_URI: string }} just the database URI, trimmed. The database layer needs
 *          nothing else, so builds without auth config (Vercel Preview) can still read packs.
 * @throws {EnvError} naming (never printing) MONGODB_URI when it's missing or invalid, or when the
 *         skip flag on a production server would use its placeholder
 */
export const parseDatabaseEnv = (
  source: Record<string, string | undefined>,
): Pick<ServerEnv, "MONGODB_URI"> => {
  const value = source.MONGODB_URI?.trim() || undefined;
  if (source.SKIP_ENV_VALIDATION === "true") {
    assertNoPlaceholderSecrets(source, ["MONGODB_URI"]);
    return { MONGODB_URI: value ?? PLACEHOLDERS.MONGODB_URI };
  }
  const parsed = databaseEnvSchema.safeParse({ MONGODB_URI: value });
  if (parsed.success) return parsed.data;
  throw new EnvError("Missing or invalid environment variables: MONGODB_URI. See .env.example.");
};

/**
 * @function getDatabaseUri
 * @returns {string} MONGODB_URI from process.env, validated on its own
 * @throws {EnvError} when it's missing or invalid
 */
export const getDatabaseUri = (): string => parseDatabaseEnv(process.env).MONGODB_URI;

/** The daily stats job's secret, read only by getCronSecret. */
export const CRON_SECRET_KEY = "CRON_SECRET";

/**
 * Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>` (/api/cron/pack-stats).
 * Optional: without it the cron route refuses every call.
 */
const cronSecretSchema = z.string().min(16).optional();

/**
 * @function getCronSecret
 * @returns {string | undefined} CRON_SECRET from process.env, trimmed, validated on its own and
 *          never memoized; undefined when unset (the cron route then refuses every call)
 * @throws {EnvError} naming (never printing) CRON_SECRET when it's set but shorter than 16
 */
export const getCronSecret = (): string | undefined => {
  const parsed = cronSecretSchema.safeParse(process.env[CRON_SECRET_KEY]?.trim() || undefined);
  if (parsed.success) return parsed.data;
  throw new EnvError(
    `Missing or invalid environment variables: ${CRON_SECRET_KEY}. See .env.example.`,
  );
};

let cached: ServerEnv | null = null;

/**
 * @function getServerEnv
 * @returns {ServerEnv} process.env, validated once and memoized
 * @throws {EnvError} when a variable is missing or invalid
 */
export const getServerEnv = (): ServerEnv => {
  cached ??= parseServerEnv(process.env);
  return cached;
};

/**
 * @function isEnvValidationSkipped
 * @returns {boolean} true in CI builds (SKIP_ENV_VALIDATION=true), where nothing may query the
 *          database: public-list pages then prerender empty
 */
export const isEnvValidationSkipped = (): boolean => process.env.SKIP_ENV_VALIDATION === "true";
