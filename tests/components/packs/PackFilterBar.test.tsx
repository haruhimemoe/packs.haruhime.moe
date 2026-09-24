/**
 * @file tests/components/packs/PackFilterBar.test.tsx
 * @desc The /packs filter bar: every control is labeled, chips and sliders work from the
 *       keyboard with ARIA values, typed values stay exact (no snapping to a coarse step),
 *       lengths take m:ss, the sort select, the phone fold (open when filters come set or arrive
 *       from the URL), "Clear filters" (and
 *       where focus goes after it), and the result count in a live region.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PackFilterBar } from "@/components/packs/PackFilterBar";
import { EMPTY_FILTERS, type PackFilters } from "@/utils/pack-filters";

function Harness({
  initial = EMPTY_FILTERS,
  onChange,
  onSearchFocus,
  resultCount,
}: {
  initial?: PackFilters;
  onChange?: (next: PackFilters) => void;
  onSearchFocus?: () => void;
  resultCount?: string;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <PackFilterBar
      filters={filters}
      onChange={(next) => {
        onChange?.(next);
        setFilters(next);
      }}
      onSearchFocus={onSearchFocus}
      resultCount={resultCount}
    />
  );
}

const setup = (props: Parameters<typeof Harness>[0] = {}) => {
  const onChange = vi.fn<(next: PackFilters) => void>();
  const user = userEvent.setup();
  render(<Harness onChange={onChange} {...props} />);
  const last = () => onChange.mock.lastCall?.[0];
  return { user, onChange, last };
};

describe("PackFilterBar", () => {
  it("labels every control", () => {
    setup();
    expect(screen.getByRole("searchbox", { name: "Search public packs" })).toBeInTheDocument();
    const sort = screen.getByRole("combobox", { name: "Sort by" });
    expect(sort).toHaveValue("new");
    expect(
      within(sort)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "Newest",
      "Recently updated",
      "Star rating, low to high",
      "Star rating, high to low",
      "Most maps",
      "Name, A to Z",
    ]);
    expect(screen.getByRole("region", { name: "Filters" })).toBeInTheDocument();
    for (const row of ["Star rating", "Mods", "Length", "BPM", "Mode", "Maps"]) {
      expect(screen.getByRole("group", { name: row })).toBeInTheDocument();
    }
    for (const end of ["star rating", "length", "BPM", "maps"]) {
      for (const side of ["Minimum", "Maximum"]) {
        expect(screen.getByRole("slider", { name: `${side} ${end}` })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: `${side} ${end}` })).toBeInTheDocument();
      }
    }
    const mods = screen.getByRole("group", { name: "Mods" });
    expect(
      within(mods)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["NM", "HD", "HR", "DT", "FM", "TB", "EZ", "HT", "FL"]);
    const modes = screen.getByRole("group", { name: "Mode" });
    expect(
      within(modes)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["osu!", "taiko", "catch", "mania"]);
  });

  it("shows open-ended sliders at their full span", () => {
    setup();
    expect(screen.getByRole("slider", { name: "Minimum star rating" })).toHaveAttribute(
      "aria-valuetext",
      "0",
    );
    expect(screen.getByRole("slider", { name: "Maximum star rating" })).toHaveAttribute(
      "aria-valuetext",
      "10+",
    );
    expect(screen.getByRole("textbox", { name: "Maximum length" })).toHaveValue("10:00+");
    expect(screen.getByRole("textbox", { name: "Minimum BPM" })).toHaveValue("60");
    expect(screen.getByRole("textbox", { name: "Maximum maps" })).toHaveValue("40+");
  });

  it("toggles mod and mode chips with Space and Enter", async () => {
    const { user, last } = setup();
    const hd = screen.getByRole("button", { name: "HD" });
    hd.focus();
    await user.keyboard(" ");
    expect(hd).toHaveAttribute("aria-pressed", "true");
    screen.getByRole("button", { name: "NM" }).focus();
    await user.keyboard("{Enter}");
    expect(last()?.mods).toEqual(["NM", "HD"]);
    hd.focus();
    await user.keyboard(" ");
    expect(hd).toHaveAttribute("aria-pressed", "false");
    expect(last()?.mods).toEqual(["NM"]);

    screen.getByRole("button", { name: "catch" }).focus();
    await user.keyboard(" ");
    expect(last()?.mode).toEqual(["fruits"]);
  });

  it("reaches the chips and sliders with Tab", async () => {
    const { user } = setup();
    const reached = new Set<Element>();
    screen.getByRole("searchbox", { name: "Search public packs" }).focus();
    for (let i = 0; i < 60; i++) {
      await user.tab();
      if (document.activeElement) reached.add(document.activeElement);
    }
    for (const control of [
      screen.getByRole("button", { name: "FL" }),
      screen.getByRole("button", { name: "mania" }),
      screen.getByRole("slider", { name: "Minimum star rating" }),
      screen.getByRole("slider", { name: "Maximum maps" }),
      screen.getByRole("textbox", { name: "Maximum length" }),
    ]) {
      expect(reached.has(control)).toBe(true);
    }
  });

  it("moves the star range with the keyboard and reports it", async () => {
    const { user, last } = setup();
    const low = screen.getByRole("slider", { name: "Minimum star rating" });
    const high = screen.getByRole("slider", { name: "Maximum star rating" });
    low.focus();
    await user.keyboard("{ArrowRight}");
    expect(low).toHaveAttribute("aria-valuetext", "0.01");
    expect(last()?.sr).toEqual([0.01, null]);
    await user.keyboard("{PageUp}");
    expect(last()?.sr).toEqual([0.11, null]);
    high.focus();
    await user.keyboard("{PageDown}");
    expect(high).toHaveAttribute("aria-valuetext", "9.9");
    expect(last()?.sr).toEqual([0.11, 9.9]);
    await user.keyboard("{End}");
    expect(high).toHaveAttribute("aria-valuetext", "10+");
    expect(last()?.sr).toEqual([0.11, null]);
    low.focus();
    await user.keyboard("{Home}");
    expect(last()?.sr).toBeNull();
  });

  it("keeps typed values as typed instead of snapping them to a coarse step", async () => {
    const { user, last } = setup();
    const stars = screen.getByRole("textbox", { name: "Maximum star rating" });
    await user.clear(stars);
    await user.type(stars, "5.25{Enter}");
    expect(last()?.sr).toEqual([0, 5.25]);
    expect(stars).toHaveValue("5.25");
    const bpm = screen.getByRole("textbox", { name: "Minimum BPM" });
    await user.clear(bpm);
    await user.type(bpm, "178{Enter}");
    expect(last()?.bpm).toEqual([178, null]);
    const length = screen.getByRole("textbox", { name: "Minimum length" });
    await user.clear(length);
    await user.type(length, "1:40{Enter}");
    expect(last()?.len).toEqual([100, null]);
    expect(length).toHaveValue("1:40");
  });

  it("moves length by a second and BPM by one with the arrows, ten with Page Up", async () => {
    const { user, last } = setup();
    screen.getByRole("slider", { name: "Minimum length" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(last()?.len).toEqual([1, null]);
    await user.keyboard("{PageUp}");
    expect(last()?.len).toEqual([11, null]);
    screen.getByRole("slider", { name: "Minimum BPM" }).focus();
    await user.keyboard("{ArrowRight}{PageUp}");
    expect(last()?.bpm).toEqual([71, null]);
  });

  it("reads typed lengths as m:ss, or minutes", async () => {
    const { user, last } = setup();
    const low = screen.getByRole("textbox", { name: "Minimum length" });
    await user.clear(low);
    await user.type(low, "1:30{Enter}");
    expect(last()?.len).toEqual([90, null]);
    expect(low).toHaveValue("1:30");
    const high = screen.getByRole("textbox", { name: "Maximum length" });
    await user.clear(high);
    await user.type(high, "3{Enter}");
    expect(last()?.len).toEqual([90, 180]);
    expect(high).toHaveValue("3:00");
    expect(screen.getByRole("slider", { name: "Maximum length" })).toHaveAttribute(
      "aria-valuetext",
      "3:00",
    );
  });

  it("takes typed BPM and map counts", async () => {
    const { user, last } = setup();
    const bpm = screen.getByRole("textbox", { name: "Minimum BPM" });
    await user.clear(bpm);
    await user.type(bpm, "180{Enter}");
    expect(last()?.bpm).toEqual([180, null]);
    const maps = screen.getByRole("textbox", { name: "Maximum maps" });
    await user.clear(maps);
    await user.type(maps, "16{Enter}");
    expect(last()?.maps).toEqual([1, 16]);
  });

  it("changes the search text and the sort", async () => {
    const onSearchFocus = vi.fn();
    const { user, last } = setup({ onSearchFocus });
    await user.type(screen.getByRole("searchbox", { name: "Search public packs" }), "cup");
    expect(onSearchFocus).toHaveBeenCalled();
    expect(last()?.q).toBe("cup");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "Most maps");
    expect(last()).toMatchObject({ q: "cup", sort: "maps" });
  });

  it("offers Clear filters only while a filter is set, keeping the search and sort", async () => {
    const { user, last } = setup({
      initial: {
        ...EMPTY_FILTERS,
        q: "cup",
        sort: "name",
        sr: [5, 6],
        mods: ["DT"],
        mode: ["osu"],
        maps: [5, 20],
      },
    });
    const clear = screen.getByRole("button", { name: "Clear filters" });
    clear.focus();
    await user.keyboard("{Enter}");
    expect(last()).toEqual({ ...EMPTY_FILTERS, q: "cup", sort: "name" });
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DT" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { name: "Filters" })).toHaveFocus();
  });

  it("hides Clear filters for a search or sort alone", () => {
    setup({ initial: { ...EMPTY_FILTERS, q: "cup", sort: "maps" } });
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows the result count in a polite live region", () => {
    setup({ resultCount: "12 packs match." });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("12 packs match.");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("folds the rows behind a toggle on phones", async () => {
    const { user } = setup();
    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("starts with the rows open on phones when filters are already set", () => {
    setup({ initial: { ...EMPTY_FILTERS, mods: ["DT"] } });
    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("stays folded for a search or sort alone", () => {
    setup({ initial: { ...EMPTY_FILTERS, q: "cup", sort: "maps" } });
    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens the rows again when filters arrive from the URL (a new urlReads)", () => {
    const view = render(<PackFilterBar filters={EMPTY_FILTERS} onChange={() => {}} urlReads={0} />);
    const toggle = () => screen.getByRole("button", { name: "Filters" });
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    const fromUrl = { ...EMPTY_FILTERS, sr: [5, 6] as const };
    // A change made on the page leaves the fold alone.
    view.rerender(<PackFilterBar filters={fromUrl} onChange={() => {}} urlReads={0} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    view.rerender(<PackFilterBar filters={fromUrl} onChange={() => {}} urlReads={1} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });
});
