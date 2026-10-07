/**
 * @file src/env.ts
 * @desc Server environment, wired to @haruhimemoe/next-kit/env: the osu! app's variables minus
 *       BETTER_AUTH_URL (MONGODB_URI, BETTER_AUTH_SECRET shared with the haruhime.moe hub to
 *       verify its session cookie, and OSU_CLIENT_ID/OSU_CLIENT_SECRET for osu! API client
 *       credentials; sign-in itself runs only on the hub), validated with zod on first use (not
 *       at import), so `next build` and every
 *       anonymous page work without database or auth variables. SKIP_ENV_VALIDATION=true (CI)
 *       swaps missing values for placeholders nothing ever connects with, and a production server
 *       refuses that when a secret would be one of them (first use throws, and so does server
 *       start: src/instrumentation.ts). ADMIN_OSU_IDS, CRON_SECRET, POOLS_SERVICE_TOKEN and HUB_URL aren't
 *       part of that env: each is read and checked on its own on every call, so a bad value only
 *       breaks what uses it, and a removed admin loses access at the next request.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import {
  createServerEnv,
  OSU_APP_PLACEHOLDERS,
  OSU_APP_SECRET_KEYS,
  optionalSecret,
  osuAppEnvSchema,
  readIdSet,
  readOrigin,
} from "@haruhimemoe/next-kit/env";
import type { z } from "zod";

/** next-kit's osu! app schema without BETTER_AUTH_URL: packs runs no better-auth of its own. */
const serverEnvSchema = osuAppEnvSchema.omit({ BETTER_AUTH_URL: true });

/** The server env: MONGODB_URI, BETTER_AUTH_SECRET (the hub's), OSU_CLIENT_ID/SECRET. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

const { BETTER_AUTH_URL: _, ...placeholders } = OSU_APP_PLACEHOLDERS;

const serverEnv = createServerEnv({
  schema: serverEnvSchema,
  placeholders,
  secretKeys: OSU_APP_SECRET_KEYS,
});

/** Every variable getServerEnv validates, for .env.example and the lazy-import checks. */
export const SERVER_ENV_KEYS = serverEnv.keys;

/**
 * @function getServerEnv
 * @returns {ServerEnv} process.env, validated once and memoized
 * @throws {EnvError} naming (never printing) each missing or invalid variable
 */
export const getServerEnv = (): ServerEnv => serverEnv.get();

/**
 * @function parseServerEnv
 * @param source {Record<string, string | undefined>} an env to validate (tests)
 * @returns {ServerEnv} the server variables, trimmed, or placeholders under SKIP_ENV_VALIDATION
 * @throws {EnvError} naming each missing or invalid variable
 */
export const parseServerEnv = (source: Record<string, string | undefined>): ServerEnv =>
  serverEnv.parse(source);

/**
 * @function assertNoPlaceholderSecrets
 * @param source {Record<string, string | undefined>} usually process.env
 * @returns {void} nothing, unless SKIP_ENV_VALIDATION is set on a production server with a secret
 *          missing or equal to its public placeholder
 * @throws {EnvError} naming (never printing) each such secret
 */
export const assertNoPlaceholderSecrets = (source: Record<string, string | undefined>): void =>
  serverEnv.assertNoPlaceholderSecrets(source);

/**
 * @function getDatabaseUri
 * @returns {string} MONGODB_URI, validated on its own, so builds without auth config (Vercel
 *          Preview) can still read packs
 * @throws {EnvError} when it's missing or invalid
 */
export const getDatabaseUri = (): string =>
  serverEnv.pick(process.env, ["MONGODB_URI"]).MONGODB_URI;

/** osu! user ids allowed into /admin, comma-separated. Unset: no admins. */
export const ADMIN_OSU_IDS_KEY = "ADMIN_OSU_IDS";

/**
 * @function getAdminOsuIds
 * @returns {ReadonlySet<number>} the admins' osu! ids, read on every call (never memoized)
 * @throws {EnvError} naming ADMIN_OSU_IDS when it isn't a comma-separated list of ids
 */
export const getAdminOsuIds = (): ReadonlySet<number> => readIdSet(ADMIN_OSU_IDS_KEY);

/** The daily stats job's secret, read only by getCronSecret. */
export const CRON_SECRET_KEY = "CRON_SECRET";

/**
 * @function getCronSecret
 * @returns {string | undefined} CRON_SECRET, trimmed and read on every call; undefined when
 *          unset (the cron route then refuses every call). Vercel Cron sends it as a Bearer token.
 * @throws {EnvError} naming (never printing) CRON_SECRET when it's shorter than 16
 */
export const getCronSecret = (): string | undefined => optionalSecret(CRON_SECRET_KEY, 16);

/** The token pools.haruhime.moe sends, read only by getPoolsServiceToken. */
export const POOLS_SERVICE_TOKEN_KEY = "POOLS_SERVICE_TOKEN";

/**
 * @function getPoolsServiceToken
 * @returns {string | undefined} POOLS_SERVICE_TOKEN, trimmed and read on every call; undefined
 *          when unset (the pools service routes then refuse every call)
 * @throws {EnvError} naming (never printing) POOLS_SERVICE_TOKEN when it's shorter than 32
 */
export const getPoolsServiceToken = (): string | undefined =>
  optionalSecret(POOLS_SERVICE_TOKEN_KEY, 32);

/** The haruhime.moe hub's origin: sign-in, the account page and session refreshes live there. */
export const HUB_URL_KEY = "HUB_URL";

/** The hub's origin when HUB_URL isn't set. */
export const DEFAULT_HUB_URL = "https://www.haruhime.moe";

/**
 * @function getHubUrl
 * @returns {string} HUB_URL read now (an origin), or www.haruhime.moe when it's unset
 * @throws {EnvError} naming HUB_URL when it isn't an https origin (http only on localhost)
 */
export const getHubUrl = (): string => readOrigin(HUB_URL_KEY, DEFAULT_HUB_URL);
