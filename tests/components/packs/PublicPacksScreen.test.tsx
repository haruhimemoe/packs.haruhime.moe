/**
 * @file tests/components/packs/PublicPacksScreen.test.tsx
 * @desc /packs body: cards, count, paging links, empty state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicPacksScreen } from "@/components/packs/PublicPacksScreen";
import type { PublicPackCard } from "@/schemas/public-pack";

const CARD: PublicPackCard = {
  slug: "aaaaaaaaaa",
  name: "Pokémon Cup",
  ownerName: "Chiyo",
  ownerAvatarUrl: "https://a.ppy.sh/2",
  slotCount: 12,
  excerpt: "Round of 16",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

describe("PublicPacksScreen", () => {
  it("lists cards with host, size, excerpt, and date", () => {
    render(<PublicPacksScreen packs={[CARD]} page={1} pageCount={1} total={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Public packs" })).toBeInTheDocument();
    expect(screen.getByText("1 pack shared by hosts.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pokémon Cup" })).toHaveAttribute(
      "href",
      "/p/aaaaaaaaaa",
    );
    expect(screen.getByText("Chiyo")).toBeInTheDocument();
    expect(screen.getByText("12 maps")).toBeInTheDocument();
    expect(screen.getByText("Round of 16")).toBeInTheDocument();
    expect(screen.getByText("Updated Sep 22, 2026")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
  });

  it("links newer and older pages", () => {
    render(<PublicPacksScreen packs={[CARD]} page={2} pageCount={3} total={60} />);
    const pages = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pages).getByRole("link", { name: "Newer" })).toHaveAttribute("href", "/packs");
    expect(within(pages).getByRole("link", { name: "Newer" })).toHaveAttribute("rel", "prev");
    expect(within(pages).getByRole("link", { name: "Older" })).toHaveAttribute(
      "href",
      "/packs/page/3",
    );
    expect(within(pages).getByRole("link", { name: "Older" })).toHaveAttribute("rel", "next");
    expect(within(pages).getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("explains an empty list", () => {
    render(<PublicPacksScreen packs={[]} page={1} pageCount={1} total={0} />);
    expect(
      screen.getByText("No public packs yet. Save a pack and set it to Public to list it here."),
    ).toBeInTheDocument();
  });
});
