/**
 * @file tests/components/pack/MagnetLinks.test.tsx
 * @desc The Download card's "Torrent" section: who added the links, a guide link, then each
 *       recorded magnet (canonical, once per torrent) with its date, copy, open, and remove for
 *       whoever may.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MagnetLinks } from "@/components/pack/MagnetLinks";
import { PacksApiError } from "@/lib/packs-api";
import type { PackExport } from "@/schemas/pack-export";

const A = `magnet:?xt=urn:btih:${"ab".repeat(20)}&dn=SPC`;
const B = `magnet:?xt=urn:btih:${"cd".repeat(20)}&dn=SPC`;
const EXPORTS: PackExport[] = [
  { kind: "magnet", url: A, createdAt: "2026-09-22T23:30:00.000Z" },
  { kind: "magnet", url: B, createdAt: "2026-09-20T10:00:00.000Z" },
];

describe("MagnetLinks", () => {
  it("renders nothing when there are no links", () => {
    const { container } = render(<MagnetLinks exports={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each link with its date and an Open link", () => {
    render(<MagnetLinks exports={EXPORTS} />);
    expect(screen.getByRole("region", { name: "Torrent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Torrent" })).toBeInTheDocument();
    expect(
      screen.getByText(/^Download with a torrent app\. It only works while someone seeds it\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Added by the pack owner. packs doesn't host or check these files."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How to download with a torrent" })).toHaveAttribute(
      "href",
      "/guide/download-a-torrent",
    );
    expect(screen.getByText("Added Sep 22, 2026")).toBeInTheDocument();
    expect(screen.getByText("Added Sep 20, 2026")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /^Open magnet link / })
        .map((a) => a.getAttribute("href")),
    ).toEqual([A, B]);
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("copies a link", async () => {
    const user = userEvent.setup();
    render(<MagnetLinks exports={EXPORTS} />);
    await user.click(screen.getByRole("button", { name: "Copy magnet link cdcdcdcd" }));
    expect(await navigator.clipboard.readText()).toBe(B);
    expect(screen.getByText("Magnet link copied.")).toBeInTheDocument();
  });

  it("lets the owner remove a link", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn(async (_url: string) => undefined);
    render(<MagnetLinks exports={EXPORTS} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Remove magnet link abababab" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(onRemove).toHaveBeenCalledWith(A);
  });

  it("shows the server's message when removing fails", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn(async () => {
      throw new PacksApiError("Pack not found.", 404);
    });
    render(<MagnetLinks exports={EXPORTS} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Remove magnet link abababab" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pack not found.");
  });

  it("never links a stored value that isn't a magnet link", () => {
    render(
      <MagnetLinks
        exports={[
          { kind: "magnet", url: "javascript:alert(1)", createdAt: EXPORTS[0]?.createdAt ?? "" },
          ...EXPORTS,
        ]}
      />,
    );
    expect(
      screen
        .getAllByRole("link", { name: /^Open magnet link / })
        .map((a) => a.getAttribute("href")),
    ).toEqual([A, B]);
  });

  it("links only the canonical form: no web seeds, peers, or foreign trackers, once per torrent", () => {
    render(
      <MagnetLinks
        exports={[
          {
            kind: "magnet",
            url: `${A}&ws=http%3A%2F%2F192.168.0.1%2F&x.pe=10.0.0.5%3A22&tr=http%3A%2F%2Fevil.example%2Fannounce`,
            createdAt: EXPORTS[0]?.createdAt ?? "",
          },
          {
            kind: "magnet",
            url: A.toUpperCase().replace("MAGNET:?XT=URN:BTIH:", "magnet:?xt=urn:btih:"),
            createdAt: "",
          },
          ...EXPORTS,
        ]}
      />,
    );
    expect(
      screen
        .getAllByRole("link", { name: /^Open magnet link / })
        .map((a) => a.getAttribute("href")),
    ).toEqual([A, B]);
  });

  it("asks before removing, and Keep it cancels", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn(async (_url: string) => undefined);
    render(<MagnetLinks exports={EXPORTS} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Remove magnet link abababab" }));
    expect(
      screen.getByText("Remove this link? Anyone using it can't find it here after."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove magnet link abababab" })).toBeInTheDocument();
  });
});
