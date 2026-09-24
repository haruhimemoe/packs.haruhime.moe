/**
 * @file tests/components/pack/ModsField.test.tsx
 * @desc Custom-slot Mods control: No mods / Forced / Freemod, the six chips in canonical order,
 *       blocked pairs and a fourth mod (focusable, aria-disabled, described by the reason) and
 *       going back to no mods.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { NO_MODS, type SlotMods } from "@haruhimemoe/pool";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModsField } from "@/components/pack/ModsField";

function Harness({
  initial = NO_MODS,
  onChange,
  disabled,
}: {
  initial?: SlotMods;
  onChange: (mods: SlotMods) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<SlotMods>(initial);
  return (
    <ModsField
      code="EZ"
      value={value}
      disabled={disabled}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const setup = (initial?: SlotMods, disabled?: boolean) => {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} disabled={disabled} />);
  const group = screen.getByRole("group", { name: "Mods for EZ" });
  return { onChange, group, user: userEvent.setup() };
};

describe("ModsField", () => {
  it("starts on No mods with no chips", () => {
    const { group } = setup();
    expect(within(group).getByRole("radio", { name: "No mods" })).toBeChecked();
    expect(within(group).queryByRole("button")).toBeNull();
  });

  it("sets freemod", async () => {
    const { group, onChange, user } = setup();
    await user.click(within(group).getByRole("radio", { name: "Freemod" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "free" });
  });

  it("shows six chips for Forced and saves once a mod is picked", async () => {
    const { group, onChange, user } = setup();
    await user.click(within(group).getByRole("radio", { name: "Forced" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["EZ", "HD", "HR", "DT", "HT", "FL"]);
    expect(within(group).getByText("Pick at least one mod.")).toBeInTheDocument();
    await user.click(within(group).getByRole("button", { name: "EZ" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "forced", set: ["EZ"] });
    expect(within(group).getByRole("button", { name: "EZ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps mods in canonical order", async () => {
    const { group, onChange, user } = setup({ kind: "forced", set: ["DT"] });
    await user.click(within(group).getByRole("button", { name: "HD" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "forced", set: ["HD", "DT"] });
  });

  it("blocks the other half of a pair without removing it from the tab order", async () => {
    const { group, onChange, user } = setup({ kind: "forced", set: ["EZ"] });
    const hr = within(group).getByRole("button", { name: "HR" });
    expect(hr).not.toBeDisabled();
    hr.focus();
    expect(hr).toHaveFocus();
    expect(hr).toHaveAttribute("aria-disabled", "true");
    expect(hr).toHaveAttribute("title", "EZ and HR can't be used together.");
    expect(hr).toHaveAccessibleDescription("EZ and HR can't be used together.");
    await user.click(hr);
    expect(onChange).not.toHaveBeenCalled();
    expect(hr).toHaveAttribute("aria-pressed", "false");
    expect(within(group).getByRole("button", { name: "HT" })).toBeEnabled();
  });

  it("blocks a fourth mod, described by the reason for screen readers", () => {
    const { group } = setup({ kind: "forced", set: ["HD", "DT", "FL"] });
    const ez = within(group).getByRole("button", { name: "EZ" });
    expect(ez).not.toBeDisabled();
    expect(ez).toHaveAttribute("aria-disabled", "true");
    expect(ez).toHaveAttribute("title", "A slot can force at most 3 mods.");
    expect(ez).toHaveAccessibleDescription("A slot can force at most 3 mods.");
    expect(within(group).getByRole("button", { name: "DT" })).toBeEnabled();
  });

  it("goes back to no mods when the last mod is unpicked, keeping the chips open", async () => {
    const { group, onChange, user } = setup({ kind: "forced", set: ["EZ"] });
    await user.click(within(group).getByRole("button", { name: "EZ" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "none" });
    expect(within(group).getByRole("radio", { name: "Forced" })).toBeChecked();
  });

  it("switches from Freemod to Forced", async () => {
    const { group, onChange, user } = setup({ kind: "free" });
    await user.click(within(group).getByRole("radio", { name: "Forced" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "none" });
    expect(within(group).getByRole("radio", { name: "Forced" })).toBeChecked();
    expect(within(group).getAllByRole("button")).toHaveLength(6);
  });

  it("disables everything while the editor is busy", () => {
    const { group } = setup({ kind: "forced", set: ["HD"] }, true);
    expect(within(group).getByRole("radio", { name: "No mods" })).toBeDisabled();
    expect(within(group).getByRole("button", { name: "HD" })).toBeDisabled();
  });
});
