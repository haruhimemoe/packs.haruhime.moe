/**
 * @file tests/components/layout/Header.test.tsx
 * @desc Header: home link, main nav links, wraps on narrow screens.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/Header";
import { NAV_LINKS } from "@/constants/site";

vi.mock("@/hooks/useAccount", () => ({ useAccount: () => ({ status: "signed-out" }) }));

describe("Header", () => {
  it("links the wordmark home", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: /packs/ })).toHaveAttribute("href", "/");
  });

  it("renders every nav link inside the main navigation", () => {
    render(<Header />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const { href, label } of NAV_LINKS) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("lets the nav list wrap instead of overflowing on phones", () => {
    render(<Header />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("list")).toHaveClass("flex-wrap");
  });

  it("shows the account area", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  });
});
