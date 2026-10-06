/**
 * @file tests/components/layout/AppPalette.test.tsx
 * @desc AppPalette: renders nothing until opened, opens on Ctrl K with the site's nav commands,
 *       offers the Packs extras (New pack, Paste pack key), gates My packs and Sign out on being
 *       signed in, and offers Sign in while signed out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { Account } from "@haruhimemoe/next-kit/auth-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, navigation } = vi.hoisted(() => {
  const push = vi.fn();
  return {
    push,
    navigation: () => ({ useRouter: () => ({ push }), usePathname: () => "/" }),
  };
});
vi.mock("next/navigation", navigation);
// ui's CommandPalette imports the ".js" specifier.
vi.mock("next/navigation.js", navigation);

const { account, signOut, markSignedOut } = vi.hoisted(() => ({
  account: { current: { status: "signed-out" } as Account },
  signOut: vi.fn().mockResolvedValue(undefined),
  markSignedOut: vi.fn(),
}));
vi.mock("@/lib/account", () => ({
  useAccount: () => account.current,
  markSignedOut,
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut } }));
vi.mock("@/lib/palette-packs", () => ({
  createPacksProvider: () => ({ id: "packs", search: async () => [] }),
}));

const { AppPalette } = await import("@/components/layout/AppPalette");

beforeEach(() => {
  push.mockClear();
  signOut.mockClear();
  markSignedOut.mockClear();
  account.current = { status: "signed-out" };
  localStorage.clear();
});

const openWithHotkey = async () => {
  const user = userEvent.setup();
  render(<AppPalette />);
  await user.keyboard("{Control>}k{/Control}");
};

describe("AppPalette", () => {
  it("renders nothing until opened", () => {
    render(<AppPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on Ctrl K with the site's nav commands", async () => {
    await openWithHotkey();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Go to New pack/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Go to Packs/ })).toBeInTheDocument();
  });

  it("offers the Packs extras", async () => {
    await openWithHotkey();
    expect(screen.getByRole("option", { name: /^New pack/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Paste pack key/ })).toBeInTheDocument();
  });

  it("hides My packs and Sign out while signed out, offers Sign in instead", async () => {
    await openWithHotkey();
    expect(screen.queryByRole("option", { name: /^My packs/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Sign out/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows My packs and Sign out once signed in, with no Sign in row", async () => {
    account.current = {
      status: "signed-in",
      user: { id: "u1", username: "peppy", avatarUrl: null },
    };
    await openWithHotkey();
    expect(screen.getByRole("option", { name: /^My packs/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Sign out/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("signs out, marks signed out, and navigates home when Sign out runs", async () => {
    account.current = {
      status: "signed-in",
      user: { id: "u1", username: "peppy", avatarUrl: null },
    };
    const user = userEvent.setup();
    render(<AppPalette />);
    await user.keyboard("{Control>}k{/Control}");
    await user.click(screen.getByRole("option", { name: /^Sign out/ }));
    expect(signOut).toHaveBeenCalled();
    expect(markSignedOut).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("navigates to /new when New pack runs", async () => {
    const user = userEvent.setup();
    render(<AppPalette />);
    await user.keyboard("{Control>}k{/Control}");
    await user.click(screen.getByRole("option", { name: /^New pack/ }));
    expect(push).toHaveBeenCalledWith("/new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
