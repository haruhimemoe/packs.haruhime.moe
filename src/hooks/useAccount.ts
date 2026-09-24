/**
 * @file src/hooks/useAccount.ts
 * @desc Who is signed in, for the header and the save button. Asks the server only when the
 *       readable signed-in marker is present (src/lib/signed-in-marker.ts), once per page load, so
 *       anonymous visitors cost no request. markSignedOut() updates every subscriber at once.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import { useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";
import { clearSignedInMarker, hasSignedInMarker } from "@/lib/signed-in-marker";

export type Account =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: { id: string; username: string; avatarUrl: string | null } };

export type SessionData = {
  user: { id: string; username: string; avatarUrl?: string | null };
};

export type AccountDeps = {
  getSession: () => Promise<SessionData | null>;
  readCookie: () => string;
  clearMarker: () => void;
};

export type AccountStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Account;
  markSignedOut: () => void;
  /** Ask the server even without the marker (pages that know the user is signed in). */
  recheck: () => Promise<void>;
};

const LOADING: Account = { status: "loading" };
const SIGNED_OUT: Account = { status: "signed-out" };

/**
 * @function createAccountStore
 * @param deps {AccountDeps} session fetch, cookie read, marker clear (tests pass fakes)
 * @returns {AccountStore} starts on the first subscription
 */
export const createAccountStore = ({
  getSession,
  readCookie,
  clearMarker,
}: AccountDeps): AccountStore => {
  let state: Account = LOADING;
  let started = false;
  const listeners = new Set<() => void>();
  const set = (next: Account) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const start = () => {
    if (started) return;
    started = true;
    // Another tab may sign in or out: catch up when this one is shown again. Costs a request
    // only when the marker says something changed.
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", sync);
    if (!hasSignedInMarker(readCookie())) {
      set(SIGNED_OUT);
      return;
    }
    void load();
  };
  const sync = () => {
    if (document.visibilityState === "hidden") return;
    const marked = hasSignedInMarker(readCookie());
    if (!marked && state.status === "signed-in") set(SIGNED_OUT);
    else if (marked && state.status === "signed-out") void load();
  };
  // Asks the server; a session there also (re)sets the marker cookie (src/lib/auth.ts).
  const load = (): Promise<void> =>
    getSession().then(
      (data) => {
        if (!data) {
          clearMarker();
          set(SIGNED_OUT);
          return;
        }
        const { id, username, avatarUrl } = data.user;
        set({ status: "signed-in", user: { id, username, avatarUrl: avatarUrl ?? null } });
      },
      () => set(SIGNED_OUT),
    );
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    markSignedOut: () => {
      clearMarker();
      set(SIGNED_OUT);
    },
    recheck: () => {
      started = true;
      return load();
    },
  };
};

const fetchSession = async (): Promise<SessionData | null> => {
  const { data, error } = await authClient.getSession();
  if (error) throw error;
  return data ?? null;
};

export const accountStore = createAccountStore({
  getSession: fetchSession,
  readCookie: () => document.cookie,
  clearMarker: () => clearSignedInMarker(),
});

/**
 * @function useAccount
 * @param store {AccountStore} defaults to the page-wide store
 * @returns {Account} current account state ("loading" during server render)
 */
export const useAccount = (store: AccountStore = accountStore): Account =>
  useSyncExternalStore(store.subscribe, store.getSnapshot, () => LOADING);

/**
 * @function markSignedOut
 * @returns {void} clears the marker and shows everyone as signed out without a reload
 */
export const markSignedOut = (): void => accountStore.markSignedOut();
