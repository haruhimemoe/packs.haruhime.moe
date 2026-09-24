/**
 * @file tests/components/pack/SavedPackEditor.test.tsx
 * @desc /p/[slug]/edit: save name/slots/visibility, show server errors, delete after confirming.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SavedPackEditor } from "@/components/pack/SavedPackEditor";
import { PacksApiError } from "@/lib/packs-api";
import type { SavedPack } from "@/schemas/saved-pack";
import { setupHinaiServer } from "../../helpers/hinai-server";

setupHinaiServer();
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const PACK: SavedPack = {
  name: "SPC Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 129891 },
    { mod: "TB", index: 1, beatmapId: 1872396 },
  ],
  slug: "abcdefghij",
  visibility: "unlisted",
  createdAt: "2026-09-22T23:30:00.000Z",
  updatedAt: "2026-09-22T23:30:00.000Z",
};

describe("SavedPackEditor", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("saves name, slots, and visibility, then returns to the pack", async () => {
    const user = userEvent.setup();
    const update = vi.fn(async () => PACK);
    render(<SavedPackEditor pack={PACK} update={update} remove={vi.fn()} />);
    await user.clear(screen.getByLabelText("Pack name"));
    await user.type(screen.getByLabelText("Pack name"), "  Grand Finals ");
    await user.click(screen.getByRole("button", { name: "Remove TB1" }));
    await user.click(screen.getByRole("radio", { name: /Private/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(update).toHaveBeenCalledWith("abcdefghij", {
      name: "Grand Finals",
      slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
      visibility: "private",
      description: "",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/p/abcdefghij"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's message when saving fails", async () => {
    const user = userEvent.setup();
    const update = vi.fn(async () => {
      throw new PacksApiError("Pack not found.", 404);
    });
    render(<SavedPackEditor pack={PACK} update={update} remove={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pack not found.");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("deletes only after confirming", async () => {
    const user = userEvent.setup();
    const remove = vi.fn(async () => undefined);
    render(<SavedPackEditor pack={PACK} update={vi.fn()} remove={remove} />);
    await user.click(screen.getByRole("button", { name: "Delete pack" }));
    expect(
      screen.getByText(
        "Delete this pack for good? Its short link (/p/abcdefghij) stops working for everyone. Pack keys you've shared still open the pool.",
      ),
    ).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    expect(remove).toHaveBeenCalledWith("abcdefghij");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/me"));
  });

  it("can back out of deleting", async () => {
    const user = userEvent.setup();
    render(<SavedPackEditor pack={PACK} update={vi.fn()} remove={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Delete pack" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.getByRole("button", { name: "Delete pack" })).toBeInTheDocument();
  });

  it("keeps the pack's custom slots and order when saving", async () => {
    const user = userEvent.setup();
    const update = vi.fn(async () => PACK);
    const buckets = [
      { code: "EZ", color: 0 },
      { code: "NM" as const },
      { code: "HD" as const },
      { code: "HR" as const },
      { code: "DT" as const },
      { code: "FM" as const },
      { code: "TB" as const },
    ];
    const custom: SavedPack = {
      ...PACK,
      slots: [...PACK.slots, { mod: "EZ", index: 1, beatmapId: 5 }],
      buckets,
    };
    render(<SavedPackEditor pack={custom} update={update} remove={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(update).toHaveBeenCalledWith("abcdefghij", expect.objectContaining({ buckets }));
  });

  it("edits the description and always sends it with the save", async () => {
    const user = userEvent.setup();
    const update = vi.fn(async () => PACK);
    render(
      <SavedPackEditor pack={{ ...PACK, description: "Old" }} update={update} remove={vi.fn()} />,
    );
    const box = screen.getByLabelText("Description (optional)");
    expect(box).toHaveValue("Old");
    await user.clear(box);
    await user.type(box, "Quals pool");
    expect(screen.getByText("10/500")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(update).toHaveBeenCalledWith(
      "abcdefghij",
      expect.objectContaining({ description: "Quals pool" }),
    );
  });

  it("tells the owner when a moderator hid the pack", () => {
    render(
      <SavedPackEditor
        pack={{ ...PACK, hiddenAt: "2026-09-22T12:00:00.000Z" }}
        update={vi.fn()}
        remove={vi.fn()}
      />,
    );
    expect(screen.getByText(/A moderator hid this pack/)).toBeInTheDocument();
  });

  it("warns that pool changes remove magnet links, only when the pack has some", () => {
    const url = `magnet:?xt=urn:btih:${"ab".repeat(20)}&dn=SPC`;
    const { rerender } = render(<SavedPackEditor pack={PACK} update={vi.fn()} remove={vi.fn()} />);
    expect(screen.queryByText(/removes this pack's magnet links/)).not.toBeInTheDocument();
    rerender(
      <SavedPackEditor
        pack={{ ...PACK, exports: [{ kind: "magnet", url, createdAt: PACK.createdAt }] }}
        update={vi.fn()}
        remove={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Changing the name, maps, or slots removes this pack's magnet links."),
    ).toBeInTheDocument();
  });
});
