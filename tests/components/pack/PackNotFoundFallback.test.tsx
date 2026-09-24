/**
 * @file tests/components/pack/PackNotFoundFallback.test.tsx
 * @desc The cached "Pack not found" page loads a private or hidden pack for its owner (or an
 *       admin) in the browser, and never asks without the signed-in marker.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PackNotFoundFallback } from "@/components/pack/PackNotFoundFallback";
import type { SavedPack } from "@/schemas/saved-pack";
import { setupHinaiServer } from "../../helpers/hinai-server";

setupHinaiServer();

const PACK: SavedPack = {
  name: "Secret Quals",
  slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
  slug: "abcdefghij",
  visibility: "private",
  createdAt: "2026-09-22T23:30:00.000Z",
  updatedAt: "2026-09-22T23:30:00.000Z",
  exports: [],
};

const api = (result: { pack: SavedPack; isOwner: boolean; isAdmin?: boolean } | null) => ({
  get: vi.fn(async () => result),
  addMagnet: vi.fn(),
  removeMagnet: vi.fn(),
  adminRemoveMagnet: vi.fn(),
  pin: vi.fn(),
  unpin: vi.fn(),
});

describe("PackNotFoundFallback", () => {
  it("says not found, with no request, without the marker", () => {
    const fake = api({ pack: PACK, isOwner: true });
    render(<PackNotFoundFallback slug="abcdefghij" api={fake} readCookie={() => ""} />);
    expect(screen.getByRole("heading", { level: 1, name: "Pack not found" })).toBeInTheDocument();
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("shows the owner their private pack with owner controls", async () => {
    render(
      <PackNotFoundFallback
        slug="abcdefghij"
        api={api({ pack: PACK, isOwner: true })}
        readCookie={() => "packs-signed-in=1"}
      />,
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Secret Quals" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/p/abcdefghij/edit",
    );
  });

  it("shows the moderation notice on a hidden pack", async () => {
    render(
      <PackNotFoundFallback
        slug="abcdefghij"
        api={api({
          pack: { ...PACK, visibility: "public", hiddenAt: "2026-09-22T12:00:00.000Z" },
          isOwner: true,
        })}
        readCookie={() => "packs-signed-in=1"}
      />,
    );
    expect(await screen.findByText(/A moderator hid this pack/)).toBeInTheDocument();
  });

  it("lets an admin remove a magnet link from a hidden pack", async () => {
    const magnet = `magnet:?xt=urn:btih:${"ab".repeat(20)}&dn=SPC`;
    render(
      <PackNotFoundFallback
        slug="abcdefghij"
        api={api({
          pack: {
            ...PACK,
            visibility: "public",
            hiddenAt: "2026-09-22T12:00:00.000Z",
            exports: [{ kind: "magnet", url: magnet, createdAt: PACK.createdAt }],
          },
          isOwner: false,
          isAdmin: true,
        })}
        readCookie={() => "packs-signed-in=1"}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Remove magnet link abababab" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("still says not found to a signed-in stranger", async () => {
    const fake = api(null);
    render(
      <PackNotFoundFallback slug="abcdefghij" api={fake} readCookie={() => "packs-signed-in=1"} />,
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Pack not found" }),
    ).toBeInTheDocument();
    expect(fake.get).toHaveBeenCalledWith("abcdefghij");
  });

  it('caches "Pack not found", never a loading message, in the server-rendered HTML', () => {
    const html = renderToString(
      <PackNotFoundFallback
        slug="abcdefghij"
        api={api({ pack: PACK, isOwner: true })}
        readCookie={() => "packs-signed-in=1"}
      />,
    );
    expect(html).toContain("Pack not found");
    expect(html).not.toContain("Loading pack");
  });

  it("titles the tab with the pack's name once it loads for its owner", async () => {
    document.title = "Pack not found · packs.haruhime.moe";
    render(
      <PackNotFoundFallback
        slug="abcdefghij"
        api={api({ pack: PACK, isOwner: true })}
        readCookie={() => "packs-signed-in=1"}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Secret Quals" });
    expect(document.title).toBe("Secret Quals · packs.haruhime.moe");
  });
});
