/**
 * @file tests/components/account/DeletePacksDataButton.test.tsx
 * @desc "Delete my packs data" asks in a dialog for the osu! username, says what goes (and that
 *       the haruhime account stays), reports failures there, and reloads on success.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeletePacksDataButton } from "@/components/account/DeletePacksDataButton";
import { PacksApiError } from "@/lib/packs-api";

const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("DeletePacksDataButton", () => {
  it("asks in a dialog for the osu! username, says what goes, then deletes and reloads", async () => {
    const user = userEvent.setup();
    const deletePacksData = vi.fn(async () => undefined);
    const onDeleted = vi.fn();
    render(
      <DeletePacksDataButton
        username="peppy"
        packCount={2}
        deletePacksData={deletePacksData}
        onDeleted={onDeleted}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete my packs data" }));
    const box = screen.getByRole("alertdialog", { name: "Delete your packs data?" });
    expect(box).toHaveAccessibleDescription(
      /your API key and 2 saved packs.*haruhime account stays/,
    );
    const confirm = within(box).getByRole("button", { name: "Delete for good" });
    await user.click(confirm);
    expect(deletePacksData).not.toHaveBeenCalled();
    await user.type(within(box).getByRole("textbox", { name: "Type peppy to confirm" }), "peppy");
    await user.click(confirm);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it("can be cancelled, focus back on the trigger", async () => {
    const user = userEvent.setup();
    render(
      <DeletePacksDataButton
        username="peppy"
        packCount={0}
        deletePacksData={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Delete my packs data" });
    await user.click(trigger);
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /your API key and 0 saved packs/,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog()).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("shows a failure in the dialog and stays", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const deletePacksData = vi.fn(async () => {
      throw new PacksApiError("Couldn't reach packs.haruhime.moe.", null);
    });
    render(
      <DeletePacksDataButton
        username="peppy"
        packCount={1}
        deletePacksData={deletePacksData}
        onDeleted={onDeleted}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete my packs data" }));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /your API key and 1 saved pack\./,
    );
    await user.type(screen.getByRole("textbox", { name: "Type peppy to confirm" }), "peppy");
    await user.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach packs.haruhime.moe.",
    );
    expect(dialog()).toHaveAttribute("open");
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
