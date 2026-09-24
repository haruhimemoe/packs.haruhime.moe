/**
 * @file tests/components/account/DeleteAccountButton.test.tsx
 * @desc Account deletion needs a confirm, reports failures, and leaves on success.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { PacksApiError } from "@/lib/packs-api";

describe("DeleteAccountButton", () => {
  it("says what goes, then deletes and leaves", async () => {
    const user = userEvent.setup();
    const deleteAccount = vi.fn(async () => undefined);
    const onDeleted = vi.fn();
    render(
      <DeleteAccountButton packCount={2} deleteAccount={deleteAccount} onDeleted={onDeleted} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText(/your account and 2 saved packs/)).toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountButton packCount={0} deleteAccount={vi.fn()} onDeleted={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText(/your account and 0 saved packs/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  it("shows a failure and stays", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const deleteAccount = vi.fn(async () => {
      throw new PacksApiError("Couldn't reach packs.haruhime.moe.", null);
    });
    render(
      <DeleteAccountButton packCount={1} deleteAccount={deleteAccount} onDeleted={onDeleted} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText(/your account and 1 saved pack\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach packs.haruhime.moe.",
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
