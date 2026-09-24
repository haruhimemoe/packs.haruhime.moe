/**
 * @file tests/components/packs/PublicPacksScreen.test.tsx
 * @desc /packs body: cards (with star and length ranges once a pack has stats, and the date the
 *       pack was added), count, the filter bar, paging links, empty state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
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
  createdAt: "2026-08-03T00:00:00.000Z",
};

describe("PublicPacksScreen", () => {
  it("lists cards with host, size, excerpt, and the date it was added (the list's order)", () => {
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
    expect(screen.getByText("Added Aug 3, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
  });

  it("falls back to the update date for a card without a creation date", () => {
    const { createdAt: _created, ...old } = CARD;
    render(<PublicPacksScreen packs={[old]} page={1} pageCount={1} total={1} />);
    expect(screen.getByText("Updated Sep 22, 2026")).toBeInTheDocument();
  });

  it("shows a card's star and length ranges once the pack has stats", () => {
    const rated: PublicPackCard = {
      ...CARD,
      stats: { r: [4.5, 6.2], a: 5.3, l: [95, 240], b: [150, 270], m: "NM,HD", g: "osu", k: true },
    };
    render(
      <PublicPacksScreen
        packs={[rated, { ...CARD, slug: "bbbbbbbbbb", name: "Bare" }]}
        page={1}
        pageCount={1}
        total={2}
      />,
    );
    const [withStats, without] = screen.getAllByRole("listitem");
    expect(withStats).toHaveTextContent("★ 4.50–6.20 stars");
    expect(withStats).toHaveTextContent("Length 1:35–4:00");
    expect(without).not.toHaveTextContent("★");
    expect(without).not.toHaveTextContent("Length");
  });

  it("collapses a range whose ends match, and leaves out ranges it doesn't know", () => {
    const flat: PublicPackCard = {
      ...CARD,
      stats: { r: [5.3, 5.3], a: 5.3, m: "NM", g: "osu", k: false },
    };
    render(<PublicPacksScreen packs={[flat]} page={1} pageCount={1} total={1} />);
    const card = screen.getByRole("listitem");
    expect(card).toHaveTextContent("★ 5.30 stars");
    expect(card).not.toHaveTextContent("Length");
  });

  it("puts the filter bar above the list", () => {
    render(<PublicPacksScreen packs={[CARD]} page={1} pageCount={1} total={1} />);
    expect(screen.getByRole("searchbox", { name: "Search public packs" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Filters" })).toBeInTheDocument();
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
