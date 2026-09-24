/**
 * @file tests/components/admin/AdminPackTable.test.tsx
 * @desc Admin rows: host link, status, hide/unhide, delete with confirm, errors.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPackTable } from "@/components/admin/AdminPackTable";
import { PacksApiError } from "@/lib/packs-api";
import type { AdminPackRow } from "@/schemas/public-pack";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ROW: AdminPackRow = {
  slug: "abcdefghij",
  name: "SPC Finals",
  ownerName: "host",
  ownerOsuId: 2,
  visibility: "public",
  slotCount: 2,
  updatedAt: "2026-09-22T23:30:00.000Z",
  hiddenAt: null,
  pinnedAt: null,
};

const fakeApi = () => ({
  setHidden: vi.fn(async () => ROW),
  adminRemove: vi.fn(async () => undefined),
});

describe("AdminPackTable", () => {
  beforeEach(() => refresh.mockReset());

  it("lists packs with their host, visibility, and status", () => {
    render(
      <AdminPackTable
        rows={[
          ROW,
          { ...ROW, slug: "bcdefghijk", name: "Quals", hiddenAt: "2026-09-22T12:00:00.000Z" },
        ]}
        api={fakeApi()}
      />,
    );
    expect(screen.getByRole("link", { name: "SPC Finals" })).toHaveAttribute(
      "href",
      "/p/abcdefghij",
    );
    expect(screen.getAllByRole("link", { name: "host" })[0]).toHaveAttribute(
      "href",
      "https://osu.ppy.sh/users/2",
    );
    expect(screen.getAllByText("Public")).toHaveLength(2);
    expect(screen.getByText("Hidden Sep 22, 2026")).toBeInTheDocument();
  });

  it("hides and unhides, then refreshes the page", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(
      <AdminPackTable
        rows={[
          ROW,
          { ...ROW, slug: "bcdefghijk", name: "Quals", hiddenAt: "2026-09-22T12:00:00.000Z" },
        ]}
        api={api}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Hide SPC Finals" }));
    expect(api.setHidden).toHaveBeenCalledWith("abcdefghij", true);
    await user.click(screen.getByRole("button", { name: "Unhide Quals" }));
    expect(api.setHidden).toHaveBeenCalledWith("bcdefghijk", false);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("deletes only after confirming", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<AdminPackTable rows={[ROW]} api={api} />);
    await user.click(screen.getByRole("button", { name: "Delete SPC Finals" }));
    expect(screen.getByText("Delete SPC Finals for good?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(api.adminRemove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete SPC Finals" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    expect(api.adminRemove).toHaveBeenCalledWith("abcdefghij");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the server's message when an action fails", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.setHidden.mockRejectedValueOnce(new PacksApiError("Not found.", 404));
    render(<AdminPackTable rows={[ROW]} api={api} />);
    await user.click(screen.getByRole("button", { name: "Hide SPC Finals" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says when there's nothing to show", () => {
    render(<AdminPackTable rows={[]} api={fakeApi()} />);
    expect(screen.getByText("No packs here.")).toBeInTheDocument();
  });

  it("moves focus to a confirmation after a delete, so it isn't lost with the row", async () => {
    const user = userEvent.setup();
    render(<AdminPackTable rows={[ROW]} api={fakeApi()} />);
    await user.click(screen.getByRole("button", { name: "Delete SPC Finals" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    const status = await screen.findByText("Deleted SPC Finals.");
    expect(status).toHaveFocus();
  });

  it("lets actions on different rows run at the same time", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const api = {
      setHidden: vi.fn(
        () =>
          new Promise<AdminPackRow>((resolve) => {
            finish = () => resolve(ROW);
          }),
      ),
      adminRemove: vi.fn(async () => undefined),
    };
    render(
      <AdminPackTable rows={[ROW, { ...ROW, slug: "bcdefghijk", name: "Quals" }]} api={api} />,
    );
    await user.click(screen.getByRole("button", { name: "Hide SPC Finals" }));
    expect(screen.getByRole("button", { name: "Hide SPC Finals" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hide Quals" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Hide Quals" }));
    expect(screen.getByRole("button", { name: "Hide SPC Finals" })).toBeDisabled();
    finish();
  });

  it("refocuses the confirmation on a second delete of a pack with the same name", async () => {
    const user = userEvent.setup();
    render(<AdminPackTable rows={[ROW, { ...ROW, slug: "bcdefghijk" }]} api={fakeApi()} />);
    await user.click(
      screen.getAllByRole("button", { name: "Delete SPC Finals" })[0] as HTMLElement,
    );
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    expect(await screen.findByText("Deleted SPC Finals.")).toHaveFocus();
    await user.click(
      screen.getAllByRole("button", { name: "Delete SPC Finals" })[1] as HTMLElement,
    );
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect(screen.getByText("Deleted SPC Finals.")).toHaveFocus());
  });

  it("clears the delete confirmation on the next action", async () => {
    const user = userEvent.setup();
    render(
      <AdminPackTable
        rows={[ROW, { ...ROW, slug: "bcdefghijk", name: "Quals" }]}
        api={fakeApi()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete SPC Finals" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));
    await screen.findByText("Deleted SPC Finals.");
    await user.click(screen.getByRole("button", { name: "Hide Quals" }));
    await waitFor(() => expect(screen.queryByText("Deleted SPC Finals.")).not.toBeInTheDocument());
  });
});
