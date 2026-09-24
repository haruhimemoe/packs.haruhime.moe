/**
 * @file tests/components/layout/ClearLocalDataButton.test.tsx
 * @desc Clear local data: confirm before deleting, cancel, success and failure messages.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClearLocalDataButton } from "@/components/layout/ClearLocalDataButton";

describe("ClearLocalDataButton", () => {
  it("asks first, then clears", async () => {
    const user = userEvent.setup();
    const clear = vi.fn(async () => undefined);
    render(<ClearLocalDataButton clear={clear} />);
    await user.click(screen.getByRole("button", { name: "Clear local data" }));
    expect(clear).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(clear).toHaveBeenCalledOnce();
    expect(await screen.findByText("Local data cleared.")).toBeInTheDocument();
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();
    const clear = vi.fn(async () => undefined);
    render(<ClearLocalDataButton clear={clear} />);
    await user.click(screen.getByRole("button", { name: "Clear local data" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(clear).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Clear local data" })).toBeInTheDocument();
  });

  it("says when clearing failed", async () => {
    const user = userEvent.setup();
    render(<ClearLocalDataButton clear={async () => Promise.reject(new Error("locked"))} />);
    await user.click(screen.getByRole("button", { name: "Clear local data" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/Couldn't clear everything/)).toBeInTheDocument();
  });
});
