/**
 * @file tests/components/pack/BucketManager.test.tsx
 * @desc Slots card: order with move buttons and drag, add with validation, rename, recolor, and
 *       delete only when empty.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BucketManager } from "@/components/pack/BucketManager";
import type { BucketEntry, PoolSlot } from "@/schemas/pack";

const BUCKETS: BucketEntry[] = [
  { code: "NM" },
  { code: "HD" },
  { code: "HR" },
  { code: "DT" },
  { code: "FM" },
  { code: "EZ", color: 0 },
  { code: "TB" },
];

const setup = (slots: PoolSlot[] = [], buckets = BUCKETS) => {
  const handlers = {
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onRecolor: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onSetMods: vi.fn(),
  };
  render(<BucketManager buckets={buckets} slots={slots} {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
};

const row = (name: string) => screen.getByRole("listitem", { name: new RegExp(`^${name} slot`) });

describe("BucketManager", () => {
  it("lists every bucket in pool order with its map count", () => {
    setup([{ mod: "EZ", index: 1, beatmapId: 1 }]);
    const names = screen.getAllByRole("listitem").map((item) => item.getAttribute("aria-label"));
    expect(names).toEqual([
      "No Mod slot, 0 maps",
      "Hidden slot, 0 maps",
      "Hard Rock slot, 0 maps",
      "Double Time slot, 0 maps",
      "Free Mod slot, 0 maps",
      "EZ slot, 1 map",
      "Tiebreaker slot, 0 maps",
    ]);
  });

  it("moves buckets up and down, with the ends disabled", async () => {
    const { onMove, user } = setup();
    expect(within(row("No Mod")).getByRole("button", { name: "Move NM up" })).toBeDisabled();
    expect(within(row("Tiebreaker")).getByRole("button", { name: "Move TB down" })).toBeDisabled();
    await user.click(within(row("EZ")).getByRole("button", { name: "Move EZ up" }));
    expect(onMove).toHaveBeenCalledWith("EZ", 4);
    await user.click(within(row("No Mod")).getByRole("button", { name: "Move NM down" }));
    expect(onMove).toHaveBeenLastCalledWith("NM", 1);
  });

  it("drags a bucket onto another row", () => {
    const { onMove } = setup();
    fireEvent.dragStart(row("EZ"));
    fireEvent.dragOver(row("No Mod"));
    fireEvent.drop(row("No Mod"));
    expect(onMove).toHaveBeenCalledWith("EZ", 0);
  });

  it("adds a slot with the next free color, explaining bad codes", async () => {
    const { onAdd, user } = setup();
    const input = screen.getByLabelText("New slot code");
    await user.type(input, "hd");
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That's a built-in slot.");
    expect(onAdd).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, " HT ");
    const newColors = screen.getByRole("group", { name: "Color for the new slot" });
    expect(within(newColors).getByRole("radio", { name: "Teal" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    expect(onAdd).toHaveBeenCalledWith("HT", 1);
    expect(input).toHaveValue("");
  });

  it("lets the new slot's color be picked", async () => {
    const { onAdd, user } = setup();
    await user.type(screen.getByLabelText("New slot code"), "HT");
    await user.click(
      within(screen.getByRole("group", { name: "Color for the new slot" })).getByRole("radio", {
        name: "Pink",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    expect(onAdd).toHaveBeenCalledWith("HT", 2);
  });

  it("recolors a custom bucket", async () => {
    const { onRecolor, user } = setup();
    const colors = within(row("EZ")).getByRole("group", { name: "Color for EZ" });
    await user.click(within(colors).getByRole("radio", { name: "Red" }));
    expect(onRecolor).toHaveBeenCalledWith("EZ", 7);
  });

  it("renames a custom bucket, rejecting clashes", async () => {
    const { onRename, user } = setup();
    await user.click(within(row("EZ")).getByRole("button", { name: "Rename EZ" }));
    const input = screen.getByLabelText("New code for EZ");
    await user.clear(input);
    await user.type(input, "nm");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That's a built-in slot.");
    await user.clear(input);
    await user.type(input, "Easy{Enter}");
    expect(onRename).toHaveBeenCalledWith("EZ", "Easy");
    expect(screen.queryByLabelText("New code for EZ")).not.toBeInTheDocument();
  });

  it("cancels a rename without submitting the form", async () => {
    const { onRename, user } = setup();
    await user.click(within(row("EZ")).getByRole("button", { name: "Rename EZ" }));
    const input = screen.getByLabelText("New code for EZ");
    await user.clear(input);
    await user.type(input, "Easy");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveAttribute("type", "button");
    await user.click(cancel);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("New code for EZ")).not.toBeInTheDocument();
  });

  it("deletes an empty custom bucket; one with maps says why it can't", async () => {
    const { onRemove, user } = setup();
    await user.click(within(row("EZ")).getByRole("button", { name: "Delete EZ" }));
    expect(onRemove).toHaveBeenCalledWith("EZ");
  });

  it("disables delete while a custom bucket has maps", () => {
    setup([{ mod: "EZ", index: 1, beatmapId: 1 }]);
    expect(within(row("EZ")).getByRole("button", { name: "Delete EZ" })).toBeDisabled();
    expect(within(row("EZ")).getByText("Remove or move its maps first.")).toBeInTheDocument();
  });

  it("gives built-ins no rename, recolor, or delete", () => {
    setup();
    expect(within(row("Hidden")).queryByRole("button", { name: /Rename|Delete/ })).toBeNull();
    expect(within(row("Hidden")).queryByRole("radio")).toBeNull();
  });

  it("offers mods on custom slots only, and reports a change", async () => {
    const { onSetMods, user } = setup();
    expect(within(row("Hidden")).queryByRole("group", { name: /^Mods/ })).toBeNull();
    const mods = within(row("EZ")).getByRole("group", { name: "Mods for EZ" });
    await user.click(within(mods).getByRole("radio", { name: "Freemod" }));
    expect(onSetMods).toHaveBeenCalledWith("EZ", { kind: "free" });
  });

  it("shows a custom slot's saved mods", () => {
    setup(
      [],
      [
        ...BUCKETS.slice(0, 5),
        { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
        { code: "TB" },
      ],
    );
    const mods = within(row("EZ")).getByRole("group", { name: "Mods for EZ" });
    expect(within(mods).getByRole("radio", { name: "Forced" })).toBeChecked();
    expect(within(mods).getByRole("button", { name: "EZ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
