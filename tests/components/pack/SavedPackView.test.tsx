/**
 * @file tests/components/pack/SavedPackView.test.tsx
 * @desc /p/[slug] view: Download card first (recorded magnet links, then the mirror), pool,
 *       owner-only controls, admins removing a magnet link, short link + key sharing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { SavedPackView } from "@/components/pack/SavedPackView";
import type { SavedPack } from "@/schemas/saved-pack";
import { MODDED_FAILED_NOTE } from "@/utils/slot-stars";
import { HINAI_BATCH_URL, hinaiBatchHandler, setupHinaiServer } from "../../helpers/hinai-server";

const server = setupHinaiServer();

const MAGNET = `magnet:?xt=urn:btih:${"ab".repeat(20)}&dn=SPC`;

/** True when a comes before b in the document. */
const precedes = (a: Element, b: Element): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

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

describe("SavedPackView", () => {
  it("shows the pool and both ways to share it", async () => {
    render(<SavedPackView pack={PACK} isOwner={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "SPC Finals" })).toBeInTheDocument();
    expect(screen.getByText("2 maps")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
    expect(screen.getByLabelText("Short link")).toHaveValue("http://localhost:3000/p/abcdefghij");
    expect(screen.getByLabelText("Pack key")).toHaveValue(
      encodePackKey({ name: PACK.name, slots: PACK.slots }),
    );
    expect(screen.getByRole("region", { name: "Download" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Export" })).not.toBeInTheDocument();
  });

  it("puts the Download card under the header and description, before the stats and pool", async () => {
    render(<SavedPackView pack={{ ...PACK, description: "Quals pool" }} isOwner={false} />);
    const heading = screen.getByRole("heading", { level: 1, name: "SPC Finals" });
    const description = screen.getByText("Quals pool");
    const download = screen.getByRole("region", { name: "Download" });
    const stats = screen.getByRole("region", { name: "Pack stats" });
    const map = await screen.findByRole("link", { name: "xi - FREEDOM DiVE" });
    const share = screen.getByRole("region", { name: "Share" });
    expect(precedes(heading, description)).toBe(true);
    expect(precedes(description, download)).toBe(true);
    expect(precedes(download, stats)).toBe(true);
    expect(precedes(download, map)).toBe(true);
    expect(precedes(map, share)).toBe(true);
    expect(within(download).queryByRole("link", { name: "xi - FREEDOM DiVE" })).toBeNull();
  });

  it("keeps one h1 and puts the pool under its own h2", () => {
    render(<SavedPackView pack={PACK} isOwner={false} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Download" })).toBeInTheDocument();
    const maps = screen.getByRole("region", { name: "Maps" });
    expect(within(maps).getByRole("region", { name: "Pack stats" })).toBeInTheDocument();
    expect(precedes(screen.getByRole("region", { name: "Download" }), maps)).toBe(true);
  });

  it("shows recorded magnet links first in the Download card, with the guide link", () => {
    render(
      <SavedPackView
        pack={{ ...PACK, exports: [{ kind: "magnet", url: MAGNET, createdAt: PACK.createdAt }] }}
        isOwner={false}
      />,
    );
    const download = screen.getByRole("region", { name: "Download" });
    const torrent = within(download).getByRole("region", { name: "Torrent" });
    const mirror = within(download).getByRole("region", { name: "From the mirror" });
    expect(precedes(torrent, mirror)).toBe(true);
    expect(
      within(download).getByRole("heading", { level: 3, name: "Torrent" }),
    ).toBeInTheDocument();
    expect(
      within(download).getByRole("heading", { level: 3, name: "From the mirror" }),
    ).toBeInTheDocument();
    expect(
      within(torrent).getByRole("link", { name: "How to download with a torrent" }),
    ).toHaveAttribute("href", "/guide/download-a-torrent");
    expect(
      within(mirror).getByRole("button", { name: /Download maps|Loading map info/ }),
    ).toBeInTheDocument();
    // No separate Torrent card outside the Download card.
    expect(screen.getAllByRole("region", { name: "Torrent" })).toHaveLength(1);
  });

  it("hides owner controls from everyone else", () => {
    render(<SavedPackView pack={PACK} isOwner={false} />);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Unlisted/)).not.toBeInTheDocument();
  });

  it("gives the owner an edit link and the visibility", () => {
    render(<SavedPackView pack={{ ...PACK, visibility: "private" }} isOwner />);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/p/abcdefghij/edit",
    );
    expect(screen.getByText("2 maps · Private")).toBeInTheDocument();
    expect(screen.getByText(/Only you can open the short link/)).toBeInTheDocument();
  });

  it("shows stats above the pool", async () => {
    render(<SavedPackView pack={PACK} isOwner={false} />);
    expect(screen.getByRole("region", { name: "Pack stats" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Avg ★").parentElement?.querySelector("dd")?.textContent).toMatch(
        /^\d+\.\d{2}$/,
      ),
    );
  });

  it("retries map info from the Download card, with no second retry button", async () => {
    const user = userEvent.setup();
    server.use(http.get(HINAI_BATCH_URL, () => HttpResponse.error(), { once: true }));
    render(<SavedPackView pack={PACK} isOwner={false} />);
    const card = screen.getByRole("region", { name: "Download" });
    const retry = await within(card).findByRole("button", { name: "Retry loading maps" });
    expect(screen.getAllByRole("button", { name: "Retry loading maps" })).toHaveLength(1);
    server.use(hinaiBatchHandler);
    await user.click(retry);
    expect(await screen.findByRole("link", { name: "xi - FREEDOM DiVE" })).toBeInTheDocument();
  });

  it("shows the description with its line breaks", () => {
    render(<SavedPackView pack={{ ...PACK, description: "Quals pool\nBo9" }} isOwner={false} />);
    const text = screen.getByText(
      (_, element) => element?.tagName === "P" && element.textContent === "Quals pool\nBo9",
    );
    expect(text).toHaveClass("whitespace-pre-line");
  });

  it("shows the moderation notice on a hidden pack", () => {
    render(<SavedPackView pack={{ ...PACK, hiddenAt: "2026-09-22T12:00:00.000Z" }} isOwner />);
    expect(screen.getByText(/A moderator hid this pack/)).toHaveTextContent("contact@haruhime.moe");
  });

  it("shows recorded magnet links to visitors, without Remove", () => {
    const url = MAGNET;
    render(
      <SavedPackView
        pack={{ ...PACK, exports: [{ kind: "magnet", url, createdAt: PACK.createdAt }] }}
        isOwner={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Open magnet link abababab" })).toHaveAttribute(
      "href",
      url,
    );
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("lets the owner remove a magnet link", async () => {
    const user = userEvent.setup();
    const url = MAGNET;
    const api = {
      get: vi.fn(),
      addMagnet: vi.fn(),
      removeMagnet: vi.fn(async () => []),
      adminRemoveMagnet: vi.fn(),
    };
    render(
      <SavedPackView
        pack={{ ...PACK, exports: [{ kind: "magnet", url, createdAt: PACK.createdAt }] }}
        isOwner
        api={api}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove magnet link abababab" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(api.removeMagnet).toHaveBeenCalledWith("abcdefghij", url);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Torrent" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("heading", { name: "From the mirror" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Download" })).toBeInTheDocument();
  });

  it("lets an admin remove a magnet link from someone else's pack", async () => {
    const user = userEvent.setup();
    const pack = {
      ...PACK,
      exports: [{ kind: "magnet" as const, url: MAGNET, createdAt: PACK.createdAt }],
    };
    const api = {
      get: vi.fn(async () => ({ pack, isOwner: false, isAdmin: true })),
      addMagnet: vi.fn(),
      removeMagnet: vi.fn(),
      adminRemoveMagnet: vi.fn(async () => []),
    };
    render(<SavedPackView pack={pack} api={api} readCookie={() => "packs-signed-in=1"} />);
    await user.click(await screen.findByRole("button", { name: "Remove magnet link abababab" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(api.adminRemoveMagnet).toHaveBeenCalledWith("abcdefghij", MAGNET);
    expect(api.removeMagnet).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Torrent" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("gives a signed-in visitor who isn't the owner or an admin no Remove", async () => {
    const pack = {
      ...PACK,
      exports: [{ kind: "magnet" as const, url: MAGNET, createdAt: PACK.createdAt }],
    };
    const api = {
      get: vi.fn(async () => ({ pack, isOwner: false, isAdmin: false })),
      addMagnet: vi.fn(),
      removeMagnet: vi.fn(),
      adminRemoveMagnet: vi.fn(),
    };
    render(<SavedPackView pack={pack} api={api} readCookie={() => "packs-signed-in=1"} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(
      await screen.findByRole("link", { name: "Open magnet link abababab" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("has no Torrent section or mirror heading when the pack lists no links", () => {
    render(<SavedPackView pack={PACK} isOwner />);
    expect(screen.queryByRole("region", { name: "Torrent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "From the mirror" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "How to download with a torrent" })).toBeNull();
  });

  it("has no Torrent section when no stored link is a magnet link", () => {
    render(
      <SavedPackView
        pack={{
          ...PACK,
          exports: [{ kind: "magnet", url: "javascript:alert(1)", createdAt: PACK.createdAt }],
        }}
        isOwner={false}
      />,
    );
    expect(screen.queryByRole("region", { name: "Torrent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "From the mirror" })).not.toBeInTheDocument();
  });

  it("checks ownership in the browser only when signed in", async () => {
    const api = {
      get: vi.fn(async () => ({ pack: PACK, isOwner: true })),
      addMagnet: vi.fn(),
      removeMagnet: vi.fn(),
      adminRemoveMagnet: vi.fn(),
    };
    const { unmount } = render(<SavedPackView pack={PACK} api={api} readCookie={() => ""} />);
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    unmount();
    render(<SavedPackView pack={PACK} api={api} readCookie={() => "packs-signed-in=1"} />);
    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/p/abcdefghij/edit",
    );
    expect(api.get).toHaveBeenCalledWith("abcdefghij");
  });
  it("shows osu!'s ratings with mods under a freemod slot", async () => {
    server.use(
      http.get("*/api/osu/star-ratings", ({ request }) => {
        expect(new URL(request.url).searchParams.get("q")).toBe(
          "1872396:EZ,1872396:HD,1872396:HDHR,1872396:HR",
        );
        return HttpResponse.json({
          ratings: {
            "1872396:HD": 6.16,
            "1872396:HR": 6.32,
            "1872396:HDHR": 6.44,
            "1872396:EZ": 5.63,
          },
          pending: [],
        });
      }),
    );
    render(<SavedPackView pack={PACK} isOwner={false} />);
    await screen.findByText("HDHR 6.44");
    expect(screen.getByText("With mods:").parentElement).toHaveTextContent(
      "HD 6.16 · HR 6.32 · HDHR 6.44 · EZ 5.63",
    );
  });

  it("keeps the rating without mods, with a note, when osu! can't rate a slot", async () => {
    // The default handler rates nothing and owes nothing: the TB (freemod) slot's pairs failed.
    render(<SavedPackView pack={PACK} isOwner={false} />);
    expect(await screen.findByTitle(MODDED_FAILED_NOTE)).toHaveTextContent("5.97");
  });
});
