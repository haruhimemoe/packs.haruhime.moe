/**
 * @file tests/components/layout/AccountNav.test.tsx
 * @desc Header account area: placeholder while loading, Sign in when signed out, name + avatar
 *       linking to /me when signed in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Account } from "@haruhimemoe/next-kit/auth-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountNav } from "@/components/layout/AccountNav";

const { account } = vi.hoisted(() => ({
  account: { current: { status: "loading" } as Account },
}));
vi.mock("@/lib/account", () => ({ useAccount: () => account.current }));

describe("AccountNav", () => {
  it("shows no link while loading", () => {
    account.current = { status: "loading" };
    render(<AccountNav />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers sign in when signed out", () => {
    account.current = { status: "signed-out" };
    render(<AccountNav />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  });

  it("links the username to /me when signed in", () => {
    account.current = {
      status: "signed-in",
      user: { id: "u1", username: "peppy", avatarUrl: "https://a.ppy.sh/2?1.jpeg" },
    };
    const { container } = render(<AccountNav />);
    expect(screen.getByRole("link", { name: "peppy" })).toHaveAttribute("href", "/me");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
