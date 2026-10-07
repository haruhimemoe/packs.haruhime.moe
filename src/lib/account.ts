/**
 * @file src/lib/account.ts
 * @desc The browser side of the hub session, from @haruhimemoe/next-kit/auth-react: the shared
 *       `haruhime-signed-in` marker (the hub sets and clears it on .haruhime.moe; packs only
 *       reads it), and one page-wide account store with its hook and RestoreSignedIn. The store
 *       asks packs' GET /api/session only when the marker is there, once per page load, so
 *       anonymous visitors cost no request. "Sign in" goes through /signin (a redirect to the hub's
 *       osu! sign-in, back to this page). "Sign out" stays on packs: POST /api/signout ends the
 *       hub session server-side and clears the shared cookies, then the page refreshes signed
 *       out (of every haruhime tool, since the cookies are shared). The browser never posts to
 *       the hub itself: the hub sends no CORS headers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

"use client";

import {
  type Account,
  createAccountStore,
  createSignedInMarker,
  RestoreSignedIn as KitRestoreSignedIn,
  type SessionData,
  useAccount as useKitAccount,
} from "@haruhimemoe/next-kit/auth-react";
import { createElement, type ReactNode } from "react";
import { SIGNED_IN_COOKIE } from "@/constants/site";

export type { Account };

/** has(cookieHeader) for the shared marker (packs never clears it: only the hub writes it). */
export const signedInMarker = createSignedInMarker(SIGNED_IN_COOKIE);

/**
 * @function fetchSession
 * @returns {Promise<SessionData | null>} who /api/session says is signed in, or null
 * @throws when packs can't be reached or answers an error (the store reads that as signed out)
 */
const fetchSession = async (): Promise<SessionData | null> => {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok) throw new Error(`session ${response.status}`);
  const body = (await response.json()) as { user: SessionData["user"] | null };
  return body.user ? { user: body.user } : null;
};

/** The page-wide account store. */
export const accountStore = createAccountStore({
  getSession: fetchSession,
  readCookie: () => document.cookie,
  hasMarker: signedInMarker.has,
  // The marker lives on .haruhime.moe and belongs to the hub: a stale one just costs a request.
  clearMarker: () => undefined,
});

/**
 * @function useAccount
 * @returns {Account} who is signed in: loading, signed-out, or signed-in with id, username and
 *          avatar
 */
export const useAccount = (): Account => useKitAccount(accountStore);

/**
 * @function signOut
 * @returns {Promise<void>} once POST /api/signout answered: marks every subscriber signed out and
 *          refreshes the page in place
 * @throws when packs can't be reached or refuses (nothing changes)
 */
export const signOut = async (): Promise<void> => {
  const response = await fetch("/api/signout", { method: "POST", cache: "no-store" });
  if (!response.ok) throw new Error(`sign-out ${response.status}`);
  accountStore.markSignedOut();
  window.location.reload();
};

/**
 * @function RestoreSignedIn
 * @param props {{ next?: string; pending?: ReactNode }} where to go on once the session is read
 * @returns {ReactNode} next-kit's RestoreSignedIn bound to packs' store and the shared marker
 */
export const RestoreSignedIn = (props: { next?: string; pending?: ReactNode }): ReactNode =>
  createElement(KitRestoreSignedIn, {
    ...props,
    store: accountStore,
    hasMarker: signedInMarker.has,
  });
