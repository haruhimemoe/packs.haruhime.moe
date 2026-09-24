/**
 * @file tests/components/pack/PoolTable.test.tsx
 * @desc PoolTable groups slots into bucket sections in the fixed order and handles empty pools.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PoolTable } from "@/components/pack/PoolTable";

const slots = [
  { mod: "TB" as const, index: 1, beatmapId: 3 },
  { mod: "NM" as const, index: 2, beatmapId: 2 },
  { mod: "NM" as const, index: 1, beatmapId: 1 },
];
const loading = () => ({ status: "loading" as const });

describe("PoolTable", () => {
  it("renders one labelled section per non-empty bucket, in bucket order", () => {
    render(<PoolTable slots={slots} getState={loading} />);
    const regions = screen.getAllByRole("region");
    expect(regions.map((r) => r.getAttribute("aria-label"))).toEqual(["No Mod", "Tiebreaker"]);
    expect(within(regions[0] as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(regions[0] as HTMLElement)
        .getAllByText(/^NM\d$/)
        .map((e) => e.textContent),
    ).toEqual(["NM1", "NM2"]);
  });

  it("shows an empty state", () => {
    render(<PoolTable slots={[]} getState={loading} />);
    expect(screen.getByText(/No maps yet/)).toBeInTheDocument();
  });

  it("passes the slot to onRemove", async () => {
    const onRemove = vi.fn();
    render(<PoolTable slots={slots} getState={loading} onRemove={onRemove} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove TB1" }));
    expect(onRemove).toHaveBeenCalledWith({ mod: "TB", index: 1, beatmapId: 3 });
  });

  it("puts no-slot maps first and follows the pack's bucket order", () => {
    render(
      <PoolTable
        slots={[
          { mod: "NM", index: 1, beatmapId: 1 },
          { mod: "EZ", index: 1, beatmapId: 2 },
          { mod: null, index: 1, beatmapId: 3 },
        ]}
        buckets={[
          { code: "EZ", color: 0 },
          { code: "NM" },
          { code: "HD" },
          { code: "HR" },
          { code: "DT" },
          { code: "FM" },
          { code: "TB" },
        ]}
        getState={loading}
      />,
    );
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual([
      "No slot",
      "EZ",
      "No Mod",
    ]);
  });

  it("lists every other group as a move target and passes the pick up", async () => {
    const onMove = vi.fn();
    render(<PoolTable slots={slots} getState={loading} onMove={onMove} />);
    const select = screen.getByLabelText("Move TB1 to");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual([
      "Move to…",
      "No slot",
      "NM · No Mod",
      "HD · Hidden",
      "HR · Hard Rock",
      "DT · Double Time",
      "FM · Free Mod",
    ]);
    const user = userEvent.setup();
    await user.selectOptions(select, "No slot");
    await user.click(screen.getByRole("button", { name: "Move TB1" }));
    expect(onMove).toHaveBeenCalledWith({ mod: "TB", index: 1, beatmapId: 3 }, null);
  });

  it("titles each group with just its name and count, no badge", () => {
    render(
      <PoolTable
        slots={[
          ...slots,
          { mod: null, index: 1, beatmapId: 4 },
          { mod: "EZ", index: 1, beatmapId: 5 },
        ]}
        buckets={[
          { code: "NM" },
          { code: "HD" },
          { code: "HR" },
          { code: "DT" },
          { code: "FM" },
          { code: "EZ", color: 0 },
          { code: "TB" },
        ]}
        getState={loading}
      />,
    );
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent?.replace(/\s+/g, " ")),
    ).toEqual(["No slot (1)", "No Mod (2)", "EZ (1)", "Tiebreaker (1)"]);
  });
  it("passes each slot its mods and ratings, and names a custom slot's mods", () => {
    const meta = {
      beatmapId: 5,
      beatmapsetId: 5,
      mode: "osu" as const,
      title: "t",
      artist: "a",
      version: "v",
      creator: "c",
      creatorId: 1,
      cs: 4,
      ar: 9,
      od: 8,
      hp: 5,
      bpm: 180,
      lengthSeconds: 120,
      starRating: 5,
      checksum: null,
    };
    const ez = { mod: "EZ", index: 1, beatmapId: 5 };
    render(
      <PoolTable
        slots={[ez]}
        buckets={[
          { code: "NM" },
          { code: "HD" },
          { code: "HR" },
          { code: "DT" },
          { code: "FM" },
          { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
          { code: "TB" },
        ]}
        getState={() => ({ status: "found", meta })}
        modsBySlot={new Map([["b:EZ#1", { kind: "forced", set: ["EZ"] }]])}
        ratings={new Map([["b:EZ#1", [{ mods: "EZ", stars: 4.5 }]]])}
      />,
    );
    const region = screen.getByRole("region", { name: "EZ" });
    expect(within(region).getByText(/Forced EZ/)).toBeInTheDocument();
    expect(within(region).getByTitle("5.00★ without mods")).toHaveTextContent("4.50");
  });
});
