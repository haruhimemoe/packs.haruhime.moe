/**
 * @file tests/components/pack/VisibilityField.test.tsx
 * @desc Visibility radio group.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VisibilityField } from "@/components/pack/VisibilityField";

describe("VisibilityField", () => {
  it("checks the current value and reports changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VisibilityField value="unlisted" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Who can open it" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Unlisted/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /Private/ }));
    expect(onChange).toHaveBeenCalledWith("private");
  });
});
