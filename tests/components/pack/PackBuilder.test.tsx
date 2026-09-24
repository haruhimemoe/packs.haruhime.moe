/**
 * @file tests/components/pack/PackBuilder.test.tsx
 * @desc End-to-end builder flow against the recorded mirror fixture and fake IndexedDB, and a
 *       name holding a lone surrogate (which once crashed the page), Copy ID in the pool.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "fake-indexeddb/auto";
import { decodePackKey } from "@haruhimemoe/pool";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PackBuilder } from "@/components/pack/PackBuilder";
import { MAX_SLOTS } from "@/constants/pack";
import { clearDraft, loadDraft, saveDraft } from "@/lib/storage/drafts";
import { HINAI_BATCH_URL, hinaiBatchHandler, setupHinaiServer } from "../../helpers/hinai-server";

const server = setupHinaiServer();
vi.mock("@/hooks/useAccount", () => ({ useAccount: () => ({ status: "signed-out" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ready = async () => {
  await waitFor(() => expect(screen.getByLabelText("Beatmap ID or link")).toBeEnabled());
};

describe("PackBuilder", () => {
  beforeEach(async () => {
    await clearDraft();
  });

  it("builds a pool with live metadata and a working key", async () => {
    const user = userEvent.setup();
    render(<PackBuilder />);
    await ready();
    await user.clear(screen.getByLabelText("Pack name"));
    await user.type(screen.getByLabelText("Pack name"), "SPC Quals");
    await user.type(screen.getByLabelText("Beatmap ID or link"), "129891{Enter}");
    await user.click(screen.getByLabelText("Paste a mappool"));
    await user.paste("HD1 2116202\nTB 1872396");
    await user.click(screen.getByRole("button", { name: "Add to pool" }));

    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "nekodex - new beginnings" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Wakeshima Kanon - Tsukinami" }),
    ).toBeInTheDocument();

    const key = (screen.getByLabelText("Pack key") as HTMLInputElement).value;
    expect(decodePackKey(key)).toEqual({
      name: "SPC Quals",
      slots: [
        { mod: "NM", index: 1, beatmapId: 129891 },
        { mod: "HD", index: 1, beatmapId: 2116202 },
        { mod: "TB", index: 1, beatmapId: 1872396 },
      ],
    });
    expect(screen.getByRole("region", { name: "Save" })).toBeInTheDocument();
  });

  it("autosaves and restores the draft", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PackBuilder />);
    await ready();
    await user.type(screen.getByLabelText("Beatmap ID or link"), "129891{Enter}");
    await waitFor(async () => expect((await loadDraft())?.slots).toHaveLength(1));
    unmount();
    render(<PackBuilder />);
    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
  });

  it("gives each map in the pool a Copy ID button", async () => {
    await saveDraft({
      name: "p",
      slots: [
        { mod: "TB", index: 1, beatmapId: 1872396 },
        { mod: "NM", index: 1, beatmapId: 129891 },
      ],
    });
    render(<PackBuilder />);
    await ready();
    const pool = screen.getByRole("region", { name: "Pool" });
    expect(
      within(pool)
        .getAllByRole("button", { name: /^Copy beatmap ID/ })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Copy beatmap ID 129891", "Copy beatmap ID 1872396"]);
  });

  it("removes a slot and clears the pack after confirming", async () => {
    const user = userEvent.setup();
    await saveDraft({
      name: "p",
      slots: [
        { mod: "NM", index: 1, beatmapId: 129891 },
        { mod: "NM", index: 2, beatmapId: 2116202 },
      ],
    });
    render(<PackBuilder />);
    await ready();
    await user.click(await screen.findByRole("button", { name: "Remove NM1" }));
    const nm = screen.getByRole("region", { name: "No Mod" });
    expect(within(nm).getAllByRole("listitem")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear pack" }));
    await user.click(screen.getByRole("button", { name: "Confirm clear" }));
    expect(screen.getByText(/No maps yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Pack key")).not.toBeInTheDocument();
  });

  it("shows a mirror outage per slot and recovers with Retry", async () => {
    const user = userEvent.setup();
    server.use(http.get(HINAI_BATCH_URL, () => HttpResponse.error(), { once: true }));
    await saveDraft({ name: "p", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] });
    render(<PackBuilder />);
    expect(await screen.findByText(/Couldn't reach the beatmap mirror/)).toBeInTheDocument();
    server.use(hinaiBatchHandler);
    await user.click(
      screen.getAllByRole("button", { name: "Retry loading maps" })[0] as HTMLElement,
    );
    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
  });

  it("offers Retry loading maps in the Download card too", async () => {
    const user = userEvent.setup();
    server.use(http.get(HINAI_BATCH_URL, () => HttpResponse.error(), { once: true }));
    await saveDraft({ name: "p", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] });
    render(<PackBuilder />);
    const card = await screen.findByRole("region", { name: "Download" });
    const retry = await within(card).findByRole("button", { name: "Retry loading maps" });
    server.use(hinaiBatchHandler);
    await user.click(retry);
    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
  });

  it("says when the pack is full and disables adding", async () => {
    await saveDraft({
      name: "p",
      slots: Array.from({ length: MAX_SLOTS }, (_, i) => ({
        mod: "NM" as const,
        index: i + 1,
        beatmapId: i + 1,
      })),
    });
    server.use(http.get(HINAI_BATCH_URL, () => HttpResponse.json([])));
    render(<PackBuilder />);
    expect(await screen.findByText(`This pack is full (${MAX_SLOTS} maps).`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    // Replacing existing slots still works on a full pack.
    expect(screen.getByLabelText("Paste a mappool")).toBeEnabled();
  });

  it("disarms Clear pack on Cancel and on any edit", async () => {
    const user = userEvent.setup();
    await saveDraft({ name: "p", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] });
    render(<PackBuilder />);
    await ready();
    await screen.findByRole("button", { name: "Clear pack" });
    await user.click(screen.getByRole("button", { name: "Clear pack" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Confirm clear" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear pack" }));
    await user.type(screen.getByLabelText("Beatmap ID or link"), "2116202{Enter}");
    expect(screen.queryByRole("button", { name: "Confirm clear" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear pack" })).toBeInTheDocument();
  });

  it("pastes bare IDs as no-slot maps and a custom slot, then shows them in the pool", async () => {
    const user = userEvent.setup();
    render(<PackBuilder />);
    const box = await screen.findByLabelText("Paste a mappool");
    await waitFor(() => expect(box).toBeEnabled());
    await user.click(box);
    await user.paste("129891\nEZ1 1872396");
    await user.click(screen.getByRole("button", { name: "Add to pool" }));
    expect(await screen.findByRole("region", { name: "No slot" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "EZ" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /^EZ slot, 1 map/ })).toBeInTheDocument();
  });

  it("puts a custom slot's mods in the key", async () => {
    const user = userEvent.setup();
    await saveDraft({
      name: "p",
      slots: [{ mod: "EZ", index: 1, beatmapId: 129891 }],
      buckets: [
        { code: "NM" },
        { code: "HD" },
        { code: "HR" },
        { code: "DT" },
        { code: "FM" },
        { code: "EZ", color: 0 },
        { code: "TB" },
      ],
    });
    render(<PackBuilder />);
    await ready();
    const mods = await screen.findByRole("group", { name: "Mods for EZ" });
    await user.click(within(mods).getByRole("radio", { name: "Forced" }));
    await user.click(within(mods).getByRole("button", { name: "EZ" }));
    const key = (screen.getByLabelText("Pack key") as HTMLInputElement).value;
    expect(key.startsWith("pk3.")).toBe(true);
    expect(decodePackKey(key).buckets?.find((b) => b.code === "EZ")).toEqual({
      code: "EZ",
      color: 0,
      mods: { kind: "forced", set: ["EZ"] },
    });
  });

  it("keeps rendering with a lone surrogate in the name", async () => {
    await saveDraft({ name: "p", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] });
    render(<PackBuilder />);
    await ready();
    fireEvent.change(screen.getByLabelText("Pack name"), { target: { value: "a\uD83D" } });
    const key = (screen.getByLabelText("Pack key") as HTMLInputElement).value;
    expect(key).toBe("pk1.AQRh77-9AQAB4_YHVE4");
    expect(decodePackKey(key).name).toBe("a\uFFFD");
  });
});
