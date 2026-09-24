/**
 * @file tests/components/pack/PackKeyView.test.tsx
 * @desc /k view: decodes the fragment, loads metadata, Download card before the pool, reacts to
 *       hash changes, saves a copy, retries map info from the Download card, Copy ID per map, and
 *       the archive pools each map was used in (one request for the pool; the pool itself left
 *       out by its fingerprint).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "fake-indexeddb/auto";
import { encodePackKey } from "@haruhimemoe/pool";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PackKeyView } from "@/components/pack/PackKeyView";
import { clearDraft, loadDraft } from "@/lib/storage/drafts";
import { HINAI_BATCH_URL, hinaiBatchHandler, setupHinaiServer } from "../../helpers/hinai-server";

const server = setupHinaiServer();
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useAccount", () => ({ useAccount: () => ({ status: "signed-out" }) }));

const PACK = {
  name: "SPC Finals",
  slots: [
    { mod: "NM" as const, index: 1, beatmapId: 129891 },
    { mod: "TB" as const, index: 1, beatmapId: 1872396 },
  ],
};
const KEY = encodePackKey(PACK);

const openHash = (hash: string) => window.history.replaceState(null, "", `/k${hash}`);

describe("PackKeyView", () => {
  beforeEach(async () => {
    push.mockReset();
    await clearDraft();
  });

  it("retries map info from the Download card, with no second retry button", async () => {
    const user = userEvent.setup();
    server.use(http.get(HINAI_BATCH_URL, () => HttpResponse.error(), { once: true }));
    openHash(`#${KEY}`);
    render(<PackKeyView />);
    const card = await screen.findByRole("region", { name: "Download" });
    const retry = await within(card).findByRole("button", { name: "Retry loading maps" });
    expect(screen.getAllByRole("button", { name: "Retry loading maps" })).toHaveLength(1);
    server.use(hinaiBatchHandler);
    await user.click(retry);
    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
  });

  it("shows which archive pools used each map", async () => {
    const fetchUsage = vi.fn(async (ids: readonly number[]) => ({
      beatmaps: ids.map((beatmapId) => ({
        beatmapId,
        count: beatmapId === 1872396 ? 1 : 0,
        entries:
          beatmapId === 1872396
            ? [
                {
                  slug: "aaaaaaaaaa",
                  tournament: "osu! World Cup 2023",
                  round: "Grand Finals",
                  year: 2023,
                  badged: null,
                  slot: "TB1",
                  mods: "TB",
                  fingerprint: "a".repeat(64),
                },
              ]
            : [],
      })),
    }));
    openHash(`#${KEY}`);
    render(<PackKeyView fetchUsage={fetchUsage} />);
    expect(await screen.findByRole("button", { name: "Used in 1 pool" })).toBeInTheDocument();
    expect(fetchUsage.mock.calls).toEqual([[[129891, 1872396]]]);
  });

  it("renders the pack from the fragment with live metadata", async () => {
    openHash(`#${KEY}`);
    render(<PackKeyView />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "SPC Finals" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Download" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pack key")).toHaveValue(KEY);
    expect(screen.getByRole("region", { name: "Save" })).toBeInTheDocument();
  });

  it("puts the Download card under the header, before the pool, with Save and Share after", async () => {
    openHash(`#${KEY}`);
    render(<PackKeyView />);
    const heading = await screen.findByRole("heading", { level: 1, name: "SPC Finals" });
    const map = await screen.findByRole("link", { name: "xi - FREEDOM DiVE" });
    const download = screen.getByRole("region", { name: "Download" });
    const stats = screen.getByRole("region", { name: "Pack stats" });
    const save = screen.getByRole("region", { name: "Save" });
    const share = screen.getByRole("region", { name: "Share" });
    const order = [heading, download, stats, map, save, share];
    for (const [i, node] of order.slice(1).entries()) {
      expect(
        (order[i] as Element).compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Maps" })).toContainElement(map);
    expect(screen.queryByRole("heading", { name: "From the mirror" })).not.toBeInTheDocument();
  });

  it("gives each map a Copy ID button", async () => {
    openHash(`#${KEY}`);
    render(<PackKeyView />);
    const maps = await screen.findByRole("region", { name: "Maps" });
    expect(
      within(maps)
        .getAllByRole("button", { name: /^Copy ID/ })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Copy ID 129891", "Copy ID 1872396"]);
  });

  it("wraps a long unbroken pack name instead of overflowing", async () => {
    const name = "SPC_2026_Grand_Finals_Pool_With_A_Very_Long_Name_x";
    openHash(`#${encodePackKey({ ...PACK, name })}`);
    render(<PackKeyView />);
    const heading = await screen.findByRole("heading", { level: 1, name });
    expect(heading).toHaveClass("wrap-anywhere");
    expect(heading.parentElement).toHaveClass("min-w-0");
  });

  it("explains a damaged key and offers the paste box", async () => {
    openHash(`#${KEY.slice(0, -4)}`);
    render(<PackKeyView />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Couldn't open that pack" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/damaged or incomplete/)).toBeInTheDocument();
    expect(screen.getByLabelText("Pack key or link")).toBeInTheDocument();
  });

  it("asks for a key when there is none", async () => {
    openHash("");
    render(<PackKeyView />);
    expect(await screen.findByText("Paste a pack key first.")).toBeInTheDocument();
  });

  it("follows hash changes", async () => {
    openHash(`#${KEY}`);
    render(<PackKeyView />);
    await screen.findByRole("heading", { level: 1, name: "SPC Finals" });
    const other = encodePackKey({
      name: "Other",
      slots: [{ mod: "HD", index: 1, beatmapId: 2116202 }],
    });
    act(() => {
      openHash(`#${other}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Other" })).toBeInTheDocument();
  });

  it("saves an editable copy as the draft and goes to /new", async () => {
    const user = userEvent.setup();
    openHash(`#${KEY}`);
    render(<PackKeyView />);
    await user.click(await screen.findByRole("button", { name: "Edit a copy" }));
    expect(await loadDraft()).toEqual(PACK);
    expect(push).toHaveBeenCalledWith("/new");
  });
});
