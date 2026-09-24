/**
 * @file tests/components/app/HomePage.test.tsx
 * @desc Home page: headline, primary CTA to the builder, key paste box, the three feature cards,
 *       the FAQ (how public pack filters match and sort, and where Copy ID is, included).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HOME_FAQ, HomeScreen } from "@/components/home/HomeScreen";
import type { PublicPackCard } from "@/schemas/public-pack";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const CARD: PublicPackCard = {
  slug: "aaaaaaaaaa",
  name: "Pokémon Cup",
  ownerName: "Chiyo",
  ownerAvatarUrl: null,
  slotCount: 12,
  excerpt: "",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

describe("HomeScreen", () => {
  it("says what packs is, with the builder and public packs one click away", () => {
    render(<HomeScreen recent={[]} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "osu! beatmap packs for tournament hosts" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/packs turns a mappool into one download/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New pack" })).toHaveAttribute("href", "/new");
    expect(screen.getByRole("link", { name: "Browse public packs" })).toHaveAttribute(
      "href",
      "/packs",
    );
    expect(screen.getByLabelText("Pack key or link")).toBeInTheDocument();
  });

  it("describes only what works today", () => {
    render(<HomeScreen recent={[]} />);
    for (const name of ["Build", "Share", "Download"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/one zip or a torrent/)).toBeInTheDocument();
    expect(screen.queryByText(/Google Drive|OneDrive/i)).not.toBeInTheDocument();
  });

  it("shows no sponsor banner", () => {
    render(<HomeScreen recent={[]} />);
    expect(screen.queryByText(/sponsor|Evergreen/i)).not.toBeInTheDocument();
  });

  it("shows recent public packs only when there are some", () => {
    const { rerender } = render(<HomeScreen recent={[]} />);
    expect(screen.queryByRole("heading", { name: "Recent public packs" })).not.toBeInTheDocument();
    rerender(<HomeScreen recent={[CARD]} />);
    expect(screen.getByRole("heading", { name: "Recent public packs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pokémon Cup" })).toHaveAttribute(
      "href",
      "/p/aaaaaaaaaa",
    );
    expect(screen.getByRole("link", { name: "See all public packs" })).toHaveAttribute(
      "href",
      "/packs",
    );
  });

  it("says how the public pack filters match", () => {
    render(<HomeScreen recent={[]} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "How do the public pack filters match?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/range overlaps the range you set/)).toBeInTheDocument();
    expect(screen.getByText(/every mod and mode you tick/)).toBeInTheDocument();
    expect(screen.getByText(/its map count is in range/)).toBeInTheDocument();
    expect(screen.getByText(/community packs, archived pools, or both/)).toBeInTheDocument();
  });

  it("says how public packs sort, and where pinned packs go", () => {
    render(<HomeScreen recent={[]} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "How can I sort public packs?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pinned packs sit above the list until you search, filter or sort\./),
    ).toBeInTheDocument();
  });

  it("says where Copy ID is", () => {
    render(<HomeScreen recent={[]} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "How do I copy a map's ID for !mp map?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Press Copy ID on the map's row/)).toBeInTheDocument();
  });

  it("answers the common questions and describes them as FAQ data", () => {
    const { container } = render(<HomeScreen recent={[]} />);
    for (const { question } of HOME_FAQ) {
      expect(screen.getByRole("heading", { level: 3, name: question })).toBeInTheDocument();
    }
    const types = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (el) => JSON.parse(el.textContent ?? "{}")["@type"],
    );
    expect(types).toEqual(["WebApplication", "FAQPage"]);
  });
});
