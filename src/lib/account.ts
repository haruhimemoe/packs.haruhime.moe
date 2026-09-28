/**
 * @file src/lib/account.ts
 * @desc The browser's view of the signed-in account, from @haruhimemoe/next-kit/auth-react: the
 *       readable marker cookie (it holds no secret), a page-wide store that asks for the session
 *       once per page load and only with the marker, useAccount, markSignedOut, and
 *       RestoreSignedIn (asks once when the marker is missing, as after a sign-in), and next-kit's
 *       SignInWithOsu and SignOutButton bound to the client and the store.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import {
  createAccount,
  createAuthComponents,
  createSignedInMarker,
} from "@haruhimemoe/next-kit/auth-react";
import { SIGNED_IN_COOKIE } from "@/constants/site";
import { authClient } from "@/lib/auth-client";

/** has(cookieHeader) and clear() for the packs-signed-in marker. */
export const signedInMarker = createSignedInMarker(SIGNED_IN_COOKIE);

const kit = createAccount(authClient, signedInMarker);

export const {
  /** The page-wide account store. */
  store: accountStore,
  /** The account: loading, signed out, or signed in with the user. */
  useAccount,
  /** Marks the page signed out (after a sign-out or an account deletion). */
  markSignedOut,
  /** Restores the account after sign-in; with `next`, goes there after. */
  RestoreSignedIn,
} = kit;

export const {
  /** "Sign in with osu!", landing on `next`. */
  SignInWithOsu,
  /** Signs out, tells the header, and goes home. */
  SignOutButton,
} = createAuthComponents(authClient, kit);
