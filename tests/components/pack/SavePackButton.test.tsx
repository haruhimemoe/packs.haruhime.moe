/**
 * @file tests/components/pack/SavePackButton.test.tsx
 * @desc Save flow: sign-in detour (flushing the pack first), saving once, server messages.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SavePackButton } from "@/components/pack/SavePackButton";
import type { Account } from "@/hooks/useAccount";
import { PacksApiError } from "@/lib/packs-api";
import type { SavedPack } from "@/schemas/saved-pack";

const { push, account } = vi.hoisted(() => ({
  push: vi.fn(),
  account: { current: { status: "signed-out" } as Account },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useAccount", () => ({ useAccount: () => account.current }));

const PACK = { name: "  ", slots: [{ mod: "NM" as const, index: 1, beatmapId: 129891 }] };
const SAVED: SavedPack = {
  name: "Untitled pack",
  slots: PACK.slots,
  slug: "abcdefghij",
  visibility: "unlisted",
  createdAt: "2026-09-22T23:30:00.000Z",
  updatedAt: "2026-09-22T23:30:00.000Z",
};
const SIGNED_IN: Account = {
  status: "signed-in",
  user: { id: "u1", username: "peppy", avatarUrl: null },
};

describe("SavePackButton", () => {
  beforeEach(() => {
    push.mockReset();
    account.current = { status: "signed-out" };
  });

  it("flushes the pack, then sends a signed-out visitor to sign in", async () => {
    const user = userEvent.setup();
    const beforeSignIn = vi.fn(async () => undefined);
    render(
      <SavePackButton
        pack={PACK}
        signInNext="/new"
        beforeSignIn={beforeSignIn}
        signInNote="Your pack waits in the builder."
      />,
    );
    expect(screen.getByText("Your pack waits in the builder.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in to save" }));
    expect(beforeSignIn).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/signin?next=%2Fnew");
  });

  it("waits while the session loads", () => {
    account.current = { status: "loading" };
    render(<SavePackButton pack={PACK} signInNext="/new" />);
    expect(screen.getByRole("button", { name: "Sign in to save" })).toBeDisabled();
  });

  it("saves with the default name and opens the saved pack", async () => {
    account.current = SIGNED_IN;
    const user = userEvent.setup();
    const save = vi.fn(async () => SAVED);
    render(<SavePackButton pack={PACK} signInNext="/new" save={save} />);
    expect(screen.queryByText("Your pack waits in the builder.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save to account" }));
    expect(save).toHaveBeenCalledWith({ name: "Untitled pack", slots: PACK.slots });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/p/abcdefghij"));
  });

  it("saves once when clicked twice", async () => {
    account.current = SIGNED_IN;
    let finish: (value: SavedPack) => void = () => undefined;
    const save = vi.fn(() => new Promise<SavedPack>((resolve) => (finish = resolve)));
    render(<SavePackButton pack={PACK} signInNext="/new" save={save} />);
    const button = screen.getByRole("button", { name: "Save to account" });
    // Both clicks land before React re-renders the button as disabled.
    act(() => {
      button.click();
      button.click();
    });
    finish(SAVED);
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(save).toHaveBeenCalledOnce();
  });

  it("can't save an empty pack", () => {
    account.current = SIGNED_IN;
    render(<SavePackButton pack={{ name: "x", slots: [] }} signInNext="/new" />);
    expect(screen.getByRole("button", { name: "Save to account" })).toBeDisabled();
  });

  it("shows the server's message and allows another try", async () => {
    account.current = SIGNED_IN;
    const user = userEvent.setup();
    const save = vi.fn(async () => {
      throw new PacksApiError("You've saved 200 packs, the most one account can keep.", 409);
    });
    render(<SavePackButton pack={PACK} signInNext="/new" save={save} />);
    await user.click(screen.getByRole("button", { name: "Save to account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You've saved 200 packs");
    expect(screen.getByRole("button", { name: "Save to account" })).toBeEnabled();
  });

  it("sends the pack's bucket list along when it has one", async () => {
    account.current = SIGNED_IN;
    const user = userEvent.setup();
    const save = vi.fn(async () => SAVED);
    render(
      <SavePackButton
        pack={{
          name: "C",
          slots: [{ mod: null, index: 1, beatmapId: 1 }],
          buckets: [
            { code: "TB" },
            { code: "NM" },
            { code: "HD" },
            { code: "HR" },
            { code: "DT" },
            { code: "FM" },
          ],
        }}
        signInNext="/new"
        save={save}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save to account" }));
    expect(save).toHaveBeenCalledWith({
      name: "C",
      slots: [{ mod: null, index: 1, beatmapId: 1 }],
      buckets: [
        { code: "TB" },
        { code: "NM" },
        { code: "HD" },
        { code: "HR" },
        { code: "DT" },
        { code: "FM" },
      ],
    });
  });
});
