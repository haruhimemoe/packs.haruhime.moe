/**
 * @file tests/components/pack/SlotRow.test.tsx
 * @desc SlotRow in each metadata state, the optional remove control, and Copy ID (the map's
 *       beatmap ID for "!mp map").
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlotRow } from "@/components/pack/SlotRow";
import { MODDED_FAILED_NOTE, MODDED_LOADING_NOTE } from "@/utils/slot-stars";

const META: BeatmapMeta = {
  beatmapId: 129891,
  beatmapsetId: 39804,
  mode: "osu",
  title: "FREEDOM DiVE",
  artist: "xi",
  version: "FOUR DIMENSIONS",
  creator: "Nakagawa-Kanon",
  creatorId: 87065,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 222.22,
  lengthSeconds: 258,
  starRating: 7.8,
  checksum: null,
};
const SLOT = { mod: "NM" as const, index: 1, beatmapId: 129891 };
const inList = (ui: ReactNode) => render(<ul>{ui}</ul>);
const found = (meta: Partial<BeatmapMeta> = {}) => ({
  status: "found" as const,
  meta: { ...META, ...meta },
});

describe("SlotRow", () => {
  it("shows title, difficulty, mapper, stats, and links to osu!", () => {
    inList(<SlotRow slot={SLOT} entry={{ code: "NM" }} state={found()} />);
    const link = screen.getByRole("link", { name: /^xi - FREEDOM DiVE/ });
    expect(link).toHaveAttribute("href", "https://osu.ppy.sh/beatmaps/129891");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/\[FOUR DIMENSIONS\] mapped by Nakagawa-Kanon/)).toBeInTheDocument();
    expect(screen.getByText("4:18")).toBeInTheDocument();
    expect(screen.getByText("NM1")).toBeInTheDocument();
  });

  it("truncates long titles and keeps the full text in the title attribute", () => {
    const long = "y".repeat(300);
    inList(<SlotRow slot={SLOT} entry={null} state={found({ artist: long, title: long })} />);
    const title = screen.getByRole("link", { name: new RegExp(`^${long} - ${long}`) }).closest("p");
    expect(title?.className).toContain("truncate");
    expect(title).toHaveAttribute("title", `${long} - ${long}`);
  });

  it("opens the map on osu! in a new tab", () => {
    inList(<SlotRow slot={SLOT} entry={{ code: "NM" }} state={found()} />);
    const link = screen.getByRole("link", { name: /\(opens in a new tab\)$/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows a busy placeholder card with the ID while loading", () => {
    inList(<SlotRow slot={SLOT} entry={null} state={{ status: "loading" }} />);
    expect(screen.getByRole("listitem")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("link", { name: /^Beatmap \d+/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Copy ID \d+$/ })).toBeInTheDocument();
  });

  it("says a missing map wasn't found on the mirror", () => {
    inList(<SlotRow slot={SLOT} entry={null} state={{ status: "missing" }} />);
    expect(screen.getByText(/wasn't found on the mirror\. Check the ID\./)).toBeInTheDocument();
  });

  it("shows the error message when the mirror failed", () => {
    inList(
      <SlotRow
        slot={SLOT}
        entry={{ code: "NM" }}
        state={{ status: "error", message: "Mirror is down." }}
      />,
    );
    expect(screen.getByText("Mirror is down.")).toBeInTheDocument();
  });

  it("offers remove only when a handler is given", async () => {
    const onRemove = vi.fn();
    const { rerender } = inList(
      <SlotRow slot={SLOT} entry={{ code: "NM" }} state={{ status: "loading" }} />,
    );
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    rerender(
      <ul>
        <SlotRow
          slot={SLOT}
          entry={{ code: "NM" }}
          state={{ status: "loading" }}
          onRemove={onRemove}
        />
      </ul>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove NM1" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("makes only the title text clickable, not the whole row", () => {
    inList(<SlotRow slot={SLOT} entry={{ code: "NM" }} state={found()} />);
    const link = screen.getByRole("link", { name: /^xi - FREEDOM DiVE/ });
    expect(link).not.toHaveAttribute("data-card-link");
  });

  it("offers a Move to select when a handler is given", async () => {
    const onMove = vi.fn();
    inList(
      <SlotRow
        slot={SLOT}
        entry={{ code: "NM" }}
        state={{ status: "loading" }}
        moveTargets={[
          { value: null, label: "No slot", disabled: false },
          { value: "EZ", label: "EZ", disabled: false },
          { value: "HD", label: "HD · Hidden", disabled: true },
        ]}
        onMove={onMove}
      />,
    );
    const user = userEvent.setup();
    const select = screen.getByLabelText("Move NM1 to");
    const move = screen.getByRole("button", { name: "Move NM1" });
    expect(screen.getByRole("option", { name: "HD · Hidden" })).toBeDisabled();
    expect(move).toBeDisabled();
    // Picking an option (arrow keys fire change on Windows) never moves on its own.
    await user.selectOptions(select, "EZ");
    expect(onMove).not.toHaveBeenCalled();
    await user.click(move);
    expect(onMove).toHaveBeenCalledWith("EZ");
    expect(select).toHaveValue("");
    await user.selectOptions(select, "No slot");
    await user.click(move);
    expect(onMove).toHaveBeenLastCalledWith(null);
  });

  it("names no-slot rows for screen readers", () => {
    inList(
      <SlotRow
        slot={{ mod: null, index: 2, beatmapId: 5 }}
        entry={null}
        state={{ status: "loading" }}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove No slot 2" })).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveClass("bg-b3");
  });

  it("forgets a picked target that is no longer offered", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const targets = [
      { value: "EZ", label: "EZ", disabled: false },
      { value: "TB", label: "TB · Tiebreaker", disabled: false },
    ];
    const { rerender } = inList(
      <SlotRow
        slot={SLOT}
        entry={{ code: "NM" }}
        state={{ status: "loading" }}
        moveTargets={targets}
        onMove={onMove}
      />,
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Move NM1 to" }), "EZ");
    rerender(
      <ul>
        <SlotRow
          slot={SLOT}
          entry={{ code: "NM" }}
          state={{ status: "loading" }}
          moveTargets={targets.slice(1)}
          onMove={onMove}
        />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Move NM1" })).toBeDisabled();
  });
});

describe("SlotRow star ratings with mods", () => {
  const found = { status: "found", meta: META } as const;
  const HD_SLOT = { mod: "HD" as const, index: 1, beatmapId: 129891 };

  it("shows a forced slot's modded rating, the plain one in the title", () => {
    inList(
      <SlotRow
        slot={HD_SLOT}
        entry={{ code: "HD" }}
        state={found}
        slotMods={{ kind: "forced", set: ["HD"] }}
        ratings={[{ mods: "HD", stars: 8.14 }]}
      />,
    );
    const badge = screen.getByTitle("7.80★ without mods");
    expect(badge).toHaveTextContent("8.14");
    expect(badge.querySelector(".sr-only")).toHaveTextContent(
      /^8\.14 stars, with HD, 7\.80 without mods$/,
    );
  });

  it("keeps the plain rating while calculating, and says the one with mods is loading", () => {
    inList(
      <SlotRow
        slot={HD_SLOT}
        entry={{ code: "HD" }}
        state={found}
        slotMods={{ kind: "forced", set: ["HD"] }}
      />,
    );
    const badge = screen.getByTitle(MODDED_LOADING_NOTE);
    expect(badge).toHaveTextContent("7.80");
    expect(badge.querySelector(".sr-only")).toHaveTextContent(`7.80 stars, ${MODDED_LOADING_NOTE}`);
    expect(screen.queryByTitle(/★ without mods/)).toBeNull();
  });

  it("falls back to the plain rating with a note when the calculation failed", () => {
    inList(
      <SlotRow
        slot={HD_SLOT}
        entry={{ code: "HD" }}
        state={found}
        slotMods={{ kind: "forced", set: ["HD"] }}
        ratings={[]}
      />,
    );
    const badge = screen.getByTitle(MODDED_FAILED_NOTE);
    expect(badge).toHaveTextContent("7.80");
    expect(badge.querySelector(".sr-only")).toHaveTextContent(`7.80 stars, ${MODDED_FAILED_NOTE}`);
  });

  it("adds no screen-reader note to a slot without mods", () => {
    inList(<SlotRow slot={SLOT} entry={{ code: "NM" }} state={found} />);
    const badge = screen.getByText("7.80").parentElement as HTMLElement;
    expect(badge.querySelector(".sr-only")).toHaveTextContent(/^7\.80 stars$/);
  });

  it("adds the freemod row under the plain rating", () => {
    inList(
      <SlotRow
        slot={{ mod: "FM", index: 1, beatmapId: 129891 }}
        entry={{ code: "FM" }}
        state={found}
        slotMods={{ kind: "free" }}
        ratings={[
          { mods: "HD", stars: 6.02 },
          { mods: "HR", stars: 6.31 },
          { mods: "HDHR", stars: 6.55 },
          { mods: "EZ", stars: 4.12 },
        ]}
      />,
    );
    expect(screen.getByText("7.80")).toBeInTheDocument();
    const row = screen.getByText("With mods:").parentElement;
    expect(row).toHaveTextContent("HD 6.02 · HR 6.31 · HDHR 6.55 · EZ 4.12");
    expect(screen.getByText("With mods:")).toHaveClass("sr-only");
    // Each entry stays on one line; the row wraps only between entries.
    expect(screen.getByText("HDHR 6.55")).toHaveClass("whitespace-nowrap");
  });
});

describe("SlotRow Copy ID", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies the map's beatmap ID, not its set ID, and says so", async () => {
    const user = userEvent.setup();
    inList(<SlotRow slot={SLOT} entry={{ code: "NM" }} state={found()} />);
    const button = screen.getByRole("button", { name: "Copy ID 129891" });
    expect(button).toHaveTextContent("Copy ID");
    // The name starts with the visible label, so "click Copy ID" works for speech input.
    expect(button.getAttribute("aria-label")?.startsWith(button.textContent ?? "-")).toBe(true);
    await user.click(button);
    expect(await navigator.clipboard.readText()).toBe("129891");
    expect(screen.getByRole("status")).toHaveTextContent("Copied.");
  });

  it.each([
    { status: "loading" } as const,
    { status: "missing" } as const,
    { status: "error", message: "Mirror is down." } as const,
  ])("offers the slot's ID while the map is $status", async (state) => {
    const user = userEvent.setup();
    inList(<SlotRow slot={{ mod: null, index: 1, beatmapId: 42 }} entry={null} state={state} />);
    await user.click(screen.getByRole("button", { name: "Copy ID 42" }));
    expect(await navigator.clipboard.readText()).toBe("42");
  });

  it("shows the ID when the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    inList(<SlotRow slot={SLOT} entry={{ code: "NM" }} state={found()} />);
    await user.click(screen.getByRole("button", { name: "Copy ID 129891" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Couldn't copy. The beatmap ID is 129891.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("Copied.");
  });

  it("keeps room for the status before Copy ID, so a press never moves the row", () => {
    inList(<SlotRow slot={SLOT} entry={null} state={found()} />);
    const button = screen.getByRole("button", { name: /^Copy ID / });
    const output = button.parentElement?.querySelector("output");
    expect(output?.className).toContain("min-w-[4.5rem]");
    expect(
      button.compareDocumentPosition(output as Node) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it("puts the controls under the map below the 2xl container width", () => {
    inList(<SlotRow slot={SLOT} entry={null} state={found()} onRemove={() => {}} />);
    const group = screen.getByRole("button", { name: /^Remove / }).parentElement as HTMLElement;
    expect(group.className).toContain("@2xl:w-auto");
  });
});
