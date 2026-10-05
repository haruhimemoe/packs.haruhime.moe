/**
 * @file tests/components/export/TorrentMadePanel.test.tsx
 * @desc TorrentMadePanel: the magnet link on CopyField, its Copy button described by the field's
 *       label, and for an owner the "Add magnet link to this pack" action after Copy.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TorrentMadePanel } from "@/components/export/TorrentMadePanel";
import type { BuiltTorrent } from "@/lib/torrent/build-torrent";

const HASH = "d63ba49c4cbf76ee46bfc94476183f1710de7d09";
const BUILT: BuiltTorrent = {
  torrent: new Uint8Array([1, 2]),
  infoHash: HASH,
  magnet: `magnet:?xt=urn:btih:${HASH}&dn=SPC%20Quals`,
  totalBytes: 2,
  pieceLength: 16_384,
};

describe("TorrentMadePanel", () => {
  it("shows the magnet link and copies it, described by the field's label", async () => {
    const user = userEvent.setup();
    render(<TorrentMadePanel built={BUILT} folder="SPC Quals" onSave={() => undefined} />);
    expect(screen.getByLabelText("Magnet link")).toHaveValue(BUILT.magnet);
    const button = screen.getByRole("button", { name: "Copy magnet link" });
    expect(button).toHaveAccessibleDescription("Magnet link");
    await user.click(button);
    expect(await navigator.clipboard.readText()).toBe(BUILT.magnet);
    expect(screen.getByRole("status")).toHaveTextContent("Magnet link copied.");
  });

  it("puts Add magnet link to this pack after Copy for the owner", () => {
    render(
      <TorrentMadePanel
        built={BUILT}
        folder="SPC Quals"
        onSave={() => undefined}
        magnets={{ added: [], add: vi.fn() }}
      />,
    );
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    const copyIndex = buttons.indexOf("Copy magnet link");
    const addIndex = buttons.indexOf("Add magnet link to this pack");
    expect(copyIndex).toBeGreaterThanOrEqual(0);
    expect(addIndex).toBeGreaterThan(copyIndex);
  });

  it("has no Add action without magnets", () => {
    render(<TorrentMadePanel built={BUILT} folder="SPC Quals" onSave={() => undefined} />);
    expect(
      screen.queryByRole("button", { name: "Add magnet link to this pack" }),
    ).not.toBeInTheDocument();
  });
});
