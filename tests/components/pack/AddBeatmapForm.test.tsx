/**
 * @file tests/components/pack/AddBeatmapForm.test.tsx
 * @desc Single-map add: bucket choice, id/link parsing, error messages, reset after add.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddBeatmapForm } from "@/components/pack/AddBeatmapForm";

describe("AddBeatmapForm", () => {
  it("adds a link to the chosen bucket and clears the input", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddBeatmapForm onAdd={onAdd} />);
    await user.selectOptions(screen.getByLabelText("Slot"), "HR");
    await user.type(
      screen.getByLabelText("Beatmap ID or link"),
      "https://osu.ppy.sh/beatmapsets/39804#osu/129891",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("HR", 129891);
    expect(screen.getByLabelText("Beatmap ID or link")).toHaveValue("");
  });

  it("explains a whole-set link and doesn't add", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddBeatmapForm onAdd={onAdd} />);
    await user.type(
      screen.getByLabelText("Beatmap ID or link"),
      "https://osu.ppy.sh/beatmapsets/39804{Enter}",
    );
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/whole beatmapset/);
    expect(screen.getByLabelText("Beatmap ID or link")).toHaveAttribute("aria-invalid", "true");
  });

  it("disables everything when disabled", () => {
    render(<AddBeatmapForm onAdd={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByLabelText("Beatmap ID or link")).toBeDisabled();
  });

  it("offers No slot first, then the pack's buckets in order", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <AddBeatmapForm
        onAdd={onAdd}
        buckets={[
          { code: "EZ", color: 0 },
          { code: "NM" },
          { code: "HD" },
          { code: "HR" },
          { code: "DT" },
          { code: "FM" },
          { code: "TB" },
        ]}
      />,
    );
    const options = Array.from(
      (screen.getByLabelText("Slot") as HTMLSelectElement).querySelectorAll("option"),
    ).map((o) => o.textContent);
    expect(options.slice(0, 3)).toEqual(["No slot", "EZ", "NM · No Mod"]);
    await user.selectOptions(screen.getByLabelText("Slot"), "No slot");
    await user.type(screen.getByLabelText("Beatmap ID or link"), "129891{Enter}");
    expect(onAdd).toHaveBeenCalledWith(null, 129891);
    await user.selectOptions(screen.getByLabelText("Slot"), "EZ");
    await user.type(screen.getByLabelText("Beatmap ID or link"), "5{Enter}");
    expect(onAdd).toHaveBeenLastCalledWith("EZ", 5);
  });

  it("falls back to NM when the chosen bucket is deleted", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const withEz = [
      { code: "NM" as const },
      { code: "HD" as const },
      { code: "HR" as const },
      { code: "DT" as const },
      { code: "FM" as const },
      { code: "EZ", color: 0 },
      { code: "TB" as const },
    ];
    const { rerender } = render(<AddBeatmapForm onAdd={onAdd} buckets={withEz} />);
    await user.selectOptions(screen.getByLabelText("Slot"), "EZ");
    rerender(<AddBeatmapForm onAdd={onAdd} />);
    expect(screen.getByLabelText("Slot")).toHaveValue("NM");
  });
});
