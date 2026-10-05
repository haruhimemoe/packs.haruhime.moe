/**
 * @file tests/components/account/DeleteAccountButton.test.tsx
 * @desc Account deletion asks in a dialog for the osu! username, says what goes, reports failures
 *       there, and leaves on success.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { PacksApiError } from "@/lib/packs-api";

const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("DeleteAccountButton", () => {
  it("asks in a dialog for the osu! username, says what goes, then deletes and leaves", async () => {
    const user = userEvent.setup();
    const deleteAccount = vi.fn(async () => undefined);
    const onDeleted = vi.fn();
    render(
      <DeleteAccountButton
        username="peppy"
        packCount={2}
        deleteAccount={deleteAccount}
        onDeleted={onDeleted}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const box = screen.getByRole("alertdialog", { name: "Delete your account?" });
    expect(box).toHaveAccessibleDescription(/your account and 2 saved packs/);
    const confirm = within(box).getByRole("button", { name: "Delete my account" });
    await user.click(confirm);
    expect(deleteAccount).not.toHaveBeenCalled();
    await user.type(within(box).getByRole("textbox", { name: "Type peppy to confirm" }), "peppy");
    await user.click(confirm);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it("can be cancelled, focus back on the trigger", async () => {
    const user = userEvent.setup();
    render(
      <DeleteAccountButton
        username="peppy"
        packCount={0}
        deleteAccount={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Delete account" });
    await user.click(trigger);
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /your account and 0 saved packs/,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog()).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("shows a failure in the dialog and stays", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const deleteAccount = vi.fn(async () => {
      throw new PacksApiError("Couldn't reach packs.haruhime.moe.", null);
    });
    render(
      <DeleteAccountButton
        username="peppy"
        packCount={1}
        deleteAccount={deleteAccount}
        onDeleted={onDeleted}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /your account and 1 saved pack\./,
    );
    await user.type(screen.getByRole("textbox", { name: "Type peppy to confirm" }), "peppy");
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach packs.haruhime.moe.",
    );
    expect(dialog()).toHaveAttribute("open");
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
