/**
 * @file tests/components/hooks/useAccount.test.tsx
 * @desc useAccount asks the server for the session only when the signed-in marker is present,
 *       clears a stale marker, and flips to signed out on markSignedOut.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type AccountDeps, createAccountStore, useAccount } from "@/hooks/useAccount";

vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

const USER = { id: "u1", username: "peppy", avatarUrl: null };

const deps = (overrides: Partial<AccountDeps> = {}): AccountDeps => ({
  getSession: vi.fn(async () => ({ user: USER })),
  readCookie: () => "packs-signed-in=1",
  clearMarker: vi.fn(),
  ...overrides,
});

describe("useAccount", () => {
  it("is signed out at once, with no request, without the marker", () => {
    const d = deps({ readCookie: () => "other=1" });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "signed-out" });
    expect(d.getSession).not.toHaveBeenCalled();
  });

  it("asks once and exposes the user when the marker is present", async () => {
    const d = deps();
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "signed-in", user: USER }));
    expect(d.getSession).toHaveBeenCalledOnce();
  });

  it("clears a stale marker when the server has no session", async () => {
    const d = deps({ getSession: vi.fn(async () => null) });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current).toEqual({ status: "signed-out" }));
    expect(d.clearMarker).toHaveBeenCalledOnce();
  });

  it("is signed out when the session request fails", async () => {
    const d = deps({ getSession: vi.fn(async () => Promise.reject(new Error("500"))) });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current).toEqual({ status: "signed-out" }));
  });

  it("flips to signed out and clears the marker on markSignedOut", async () => {
    const d = deps();
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    act(() => store.markSignedOut());
    expect(result.current).toEqual({ status: "signed-out" });
    expect(d.clearMarker).toHaveBeenCalledOnce();
  });

  it("rechecks on request even without the marker (a session from before the marker existed)", async () => {
    const d = deps({ readCookie: () => "" });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "signed-out" });
    await act(() => store.recheck());
    expect(result.current).toEqual({ status: "signed-in", user: USER });
    expect(d.getSession).toHaveBeenCalledOnce();
  });

  it("catches up with a sign-out in another tab when this one is shown again", async () => {
    let cookie = "packs-signed-in=1";
    const d = deps({ readCookie: () => cookie });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    cookie = "";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("catches up with a sign-in in another tab when this one is shown again", async () => {
    let cookie = "";
    const d = deps({ readCookie: () => cookie });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "signed-out" });
    cookie = "packs-signed-in=1";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(result.current).toEqual({ status: "signed-in", user: USER }));
    expect(d.getSession).toHaveBeenCalledOnce();
  });

  it("asks nothing on tab switches when nothing changed", async () => {
    const d = deps({ readCookie: () => "" });
    const store = createAccountStore(d);
    renderHook(() => useAccount(store));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(d.getSession).not.toHaveBeenCalled();
  });
});
