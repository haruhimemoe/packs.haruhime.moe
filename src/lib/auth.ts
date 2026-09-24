/**
 * @file src/lib/auth.ts
 * @desc better-auth, built on first use: MongoDB adapter on the shared client, osu! generic OAuth
 *       (identify + public, PKCE). getUserFromHeaders() is how route handlers read the caller.
 *       System users (`system: true`, like the archive account that owns imported pools) can
 *       never act: no session or osu! account link is ever created for one, and a session that
 *       reaches one anyway reads as signed out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { OSU_OAUTH, OSU_SIGN_IN_SCOPES, toOsuUser } from "@haruhimemoe/osu/shapes";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { ObjectId } from "mongodb";
import { OSU_PROVIDER_ID } from "@/constants/auth";
import { getServerEnv } from "@/env";
import { isAdminOsuId } from "@/lib/admin";
import { getDb, getMongoClient } from "@/lib/db";
import { markerMaxAge, SIGNED_IN_COOKIE } from "@/lib/signed-in-marker";

/**
 * @function osuProfileToUser
 * @param raw {unknown} the /api/v2/me profile better-auth fetched
 * @returns the better-auth user fields. osu! OAuth returns no email, so each osu! id gets a stable
 *          synthetic one (the adapter requires an email). better-auth wants image left out, not
 *          null, when there is no avatar.
 * @throws {z.ZodError} when the profile has no id or username (never guess an identity)
 */
export const osuProfileToUser = (raw: unknown) => {
  const user = toOsuUser(raw);
  return {
    email: `${user.osuId}@osu.local`,
    emailVerified: false as const,
    name: user.username,
    ...user,
    ...(user.avatarUrl ? { image: user.avatarUrl } : {}),
  };
};

/**
 * @function isSystemUser
 * @param userId {unknown} a user id as better-auth passes it (a hex string) or an ObjectId
 * @returns {Promise<boolean>} true when that users record is a system account (`system: true`)
 */
export const isSystemUser = async (userId: unknown): Promise<boolean> => {
  const id =
    userId instanceof ObjectId
      ? userId
      : typeof userId === "string" && ObjectId.isValid(userId)
        ? new ObjectId(userId)
        : null;
  if (!id) return false;
  return (
    (await getDb().collection("user").countDocuments({ _id: id, system: true }, { limit: 1 })) > 0
  );
};

/** Drops OAuth tokens from an account write. */
const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
  ...account,
  accessToken: null,
  refreshToken: null,
  idToken: null,
});

const createAuth = () => {
  const env = getServerEnv();
  const markerOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: env.BETTER_AUTH_URL.startsWith("https://"),
    httpOnly: false,
  };
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(getDb(), { client: getMongoClient(), transaction: false }),
    // These fields must accept input: better-auth 1.7 drops `input: false` fields from the OAuth
    // profile too, which would fail every first sign-in. So no client may call /update-user:
    // identity only ever comes from osu!.
    disabledPaths: ["/update-user"],
    user: {
      additionalFields: {
        osuId: { type: "number", required: true },
        username: { type: "string", required: true },
        avatarUrl: { type: "string", required: false },
        countryCode: { type: "string", required: false },
        // Set only by the server on system accounts (the archive). Nothing a client or an osu!
        // profile sends can set it.
        system: { type: "boolean", required: false, input: false },
      },
    },
    databaseHooks: {
      // We never call osu! as the user, so keep no osu! tokens (privacy policy lists what we store).
      // A system account never gets an osu! account linked to it.
      account: {
        create: {
          before: async (account) =>
            (await isSystemUser(account.userId)) ? false : { data: withoutTokens(account) },
        },
        update: { before: async (account) => ({ data: withoutTokens(account) }) },
      },
      // Nobody signs in as a system account, whatever resolved to it.
      session: {
        create: {
          before: async (session) => ((await isSystemUser(session.userId)) ? false : undefined),
        },
      },
    },
    hooks: {
      // Keep the readable "signed in" marker in step with the session, so pages without it never
      // ask for the session at all (src/hooks/useAccount.ts).
      after: createAuthMiddleware(async (ctx) => {
        const set = (expiresAt: Date | string) =>
          ctx.setCookie(SIGNED_IN_COOKIE, "1", {
            ...markerOptions,
            maxAge: markerMaxAge(expiresAt),
          });
        const clear = () => ctx.setCookie(SIGNED_IN_COOKIE, "", { ...markerOptions, maxAge: 0 });
        const created = ctx.context.newSession;
        if (created) {
          set(created.session.expiresAt);
        } else if (ctx.path === "/sign-out") {
          clear();
        } else if (ctx.path === "/get-session") {
          const returned = ctx.context.returned as {
            session?: { expiresAt: Date | string };
          } | null;
          if (returned?.session) set(returned.session.expiresAt);
          else clear();
        }
      }),
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: OSU_PROVIDER_ID,
            clientId: env.OSU_CLIENT_ID,
            clientSecret: env.OSU_CLIENT_SECRET,
            ...OSU_OAUTH,
            scopes: [...OSU_SIGN_IN_SCOPES],
            pkce: true,
            // Refresh username/avatar/country on every sign-in.
            overrideUserInfo: true,
            mapProfileToUser: osuProfileToUser,
          },
        ],
      }),
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | null = null;

/**
 * @function getAuth
 * @returns {Auth} the better-auth instance (built on first call)
 * @throws {EnvError} when server env is missing
 */
export const getAuth = (): Auth => {
  instance ??= createAuth();
  return instance;
};

export type SessionUser = {
  id: string;
  osuId: number;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

/**
 * @function getUserFromHeaders
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<SessionUser | null>} the signed-in user, or null (no, forged, or expired
 *          session, or one that belongs to a system account)
 */
export const getUserFromHeaders = async (headers: Headers): Promise<SessionUser | null> => {
  const session = await getAuth().api.getSession({ headers });
  if (!session || session.user.system === true) return null;
  const { id, osuId, username, avatarUrl } = session.user;
  return { id, osuId, username, avatarUrl: avatarUrl ?? null, isAdmin: isAdminOsuId(osuId) };
};
