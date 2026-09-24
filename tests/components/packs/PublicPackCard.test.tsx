/**
 * @file tests/components/packs/PublicPackCard.test.tsx
 * @desc A public pack card: the name links the pack; an archive pack also shows an "Archived pool"
 *       badge that links its source pool in a new tab and names the source; other packs don't.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicPackCard } from "@/components/packs/PublicPackCard";
import type { PublicPackCard as PublicPack } from "@/schemas/public-pack";

const PACK: PublicPack = {
  slug: "abcdefghij",
  name: "osu! World Cup 2023 Grand Finals",
  ownerName: "haruhime archive",
  ownerAvatarUrl: null,
  slotCount: 20,
  excerpt: "Archived from otdb pool #657: https://otdb.sheppsu.me/db/mappools/657/",
  updatedAt: "2026-09-24T12:00:00.000Z",
  createdAt: "2026-09-24T12:00:00.000Z",
};

const renderCard = (pack: PublicPack) =>
  render(
    <ul>
      <PublicPackCard pack={pack} />
    </ul>,
  );

describe("PublicPackCard", () => {
  it("shows an archive pack's badge, linking its source pool in a new tab", () => {
    renderCard({
      ...PACK,
      archiveSource: { kind: "otdb", url: "https://otdb.sheppsu.me/db/mappools/657/" },
    });
    const badge = screen.getByRole("link", { name: "Archived pool from otdb" });
    expect(badge).toHaveAttribute("href", "https://otdb.sheppsu.me/db/mappools/657/");
    expect(badge).toHaveAttribute("target", "_blank");
    expect(badge).toHaveAttribute("rel", "noopener noreferrer");
    expect(badge).toHaveTextContent("Archived pool · from otdb");
    // The name stays the card's first link.
    expect(screen.getAllByRole("link")[0]).toHaveAccessibleName(PACK.name);
  });

  it("names each source by its label", () => {
    renderCard({ ...PACK, archiveSource: { kind: "otr", url: "https://otr.example/pools/1" } });
    expect(screen.getByRole("link", { name: "Archived pool from o!TR" })).toBeInTheDocument();
  });

  it("shows no badge on a community pack", () => {
    renderCard({ ...PACK, ownerName: "peppy" });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText(/Archived pool/)).not.toBeInTheDocument();
  });
});
