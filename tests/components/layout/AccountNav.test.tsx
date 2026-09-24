/**
 * @file tests/components/layout/AccountNav.test.tsx
 * @desc Header account area: placeholder while loading, Sign in when signed out, name + avatar
 *       linking to /me when signed in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountNav } from "@/components/layout/AccountNav";
import type { Account } from "@/hooks/useAccount";

const { account } = vi.hoisted(() => ({
  account: { current: { status: "loading" } as Account },
}));
vi.mock("@/hooks/useAccount", () => ({ useAccount: () => account.current }));

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
