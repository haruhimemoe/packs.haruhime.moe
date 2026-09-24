/**
 * @file tests/components/pack/MapUsage.test.tsx
 * @desc "Used in N pools": nothing without usage, pools counted once however many slots, a
 *       disclosure button (aria-expanded, aria-controls) over a hidden list, each pool linking
 *       its archive pack with its round, year and slot, and the keyboard: Enter and Space toggle,
 *       Tab reaches the links, Escape closes the list and puts focus back on the button.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MapUsage } from "@/components/pack/MapUsage";
import type { MapUsageEntry } from "@/schemas/map-usage";

const OWC: MapUsageEntry = {
  slug: "aaaaaaaaaa",
  tournament: "osu! World Cup 2023",
  round: "Grand Finals",
  year: 2023,
  badged: null,
  slot: "NM1",
  mods: "NM",
  fingerprint: "a".repeat(64),
};
const SPRING: MapUsageEntry = {
  slug: "bbbbbbbbbb",
  tournament: "Spring Cup",
  round: null,
  year: null,
  badged: null,
  slot: "HDHR2",
  mods: "HDHR",
  fingerprint: "b".repeat(64),
};
const ENTRIES = [OWC, { ...OWC, slot: "TB1", mods: "TB" }, SPRING];

describe("MapUsage", () => {
  it("shows nothing when no other pool used the map", () => {
    const { container } = render(<MapUsage beatmapId={75} entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts pools, not slots, and starts closed", () => {
    render(<MapUsage beatmapId={75} entries={ENTRIES} />);
    const button = screen.getByRole("button", { name: "Used in 2 pools" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says pool, not pools, for one", () => {
    render(<MapUsage beatmapId={75} entries={[OWC]} />);
    expect(screen.getByRole("button", { name: "Used in 1 pool" })).toBeInTheDocument();
  });

  it("opens a list of the pools, each linking its archive pack", async () => {
    const user = userEvent.setup();
    render(<MapUsage beatmapId={75} entries={ENTRIES} />);
    const button = screen.getByRole("button", { name: "Used in 2 pools" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Pools that used beatmap 75" });
    expect(button).toHaveAttribute("aria-controls", list.id);
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "osu! World Cup 2023 · Grand Finals2023 · NM1",
      "osu! World Cup 2023 · Grand Finals2023 · TB1",
      "Spring CupHDHR2",
    ]);
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["osu! World Cup 2023 · Grand Finals", "/p/aaaaaaaaaa"],
      ["osu! World Cup 2023 · Grand Finals", "/p/aaaaaaaaaa"],
      ["Spring Cup", "/p/bbbbbbbbbb"],
    ]);
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("works from the keyboard: Enter and Space toggle, Escape closes and returns focus", async () => {
    const user = userEvent.setup();
    render(<MapUsage beatmapId={75} entries={[OWC, SPRING]} />);
    const button = screen.getByRole("button", { name: "Used in 2 pools" });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.tab();
    expect(screen.getByRole("link", { name: "osu! World Cup 2023 · Grand Finals" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    // Closed, Escape does nothing and focus stays put.
    await user.keyboard("{Escape}");
    expect(button).toHaveFocus();
  });
});
