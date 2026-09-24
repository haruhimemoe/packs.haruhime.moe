/**
 * @file tests/components/export/DownloadOptions.test.tsx
 * @desc DownloadOptions: the summary when closed, the two checkboxes when open, locked while
 *       downloading.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DownloadOptions, downloadOptionsSummary } from "@/components/export/DownloadOptions";
import { DEFAULT_DOWNLOAD_CHOICES } from "@/schemas/download-choices";

describe("downloadOptionsSummary", () => {
  it.each([
    [{ videos: false, backgrounds: true }, "Download options: no videos, backgrounds"],
    [{ videos: false, backgrounds: false }, "Download options: no videos, no backgrounds"],
    [{ videos: true, backgrounds: true }, "Download options: videos, backgrounds"],
    [{ videos: true, backgrounds: false }, "Download options: videos, no backgrounds"],
  ])("%j → %j", (choices, text) => {
    expect(downloadOptionsSummary(choices)).toBe(text);
  });
});

describe("DownloadOptions", () => {
  it("starts closed, with the choice in the button", () => {
    render(<DownloadOptions choices={DEFAULT_DOWNLOAD_CHOICES} onChange={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Download options: no videos, backgrounds" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("opens to two checkboxes that report the new choice", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DownloadOptions choices={DEFAULT_DOWNLOAD_CHOICES} onChange={onChange} />);
    const toggle = screen.getByRole("button", { name: "Download options: no videos, backgrounds" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Download options");
    expect(screen.getByRole("checkbox", { name: /Include videos/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Include backgrounds/ })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /Include backgrounds/ }));
    expect(onChange).toHaveBeenCalledWith({ videos: false, backgrounds: false });
    await user.click(screen.getByRole("checkbox", { name: /Include videos/ }));
    expect(onChange).toHaveBeenLastCalledWith({ videos: true, backgrounds: true });
  });

  it("locks the checkboxes and says why while the card is busy", async () => {
    const user = userEvent.setup();
    render(<DownloadOptions choices={DEFAULT_DOWNLOAD_CHOICES} onChange={vi.fn()} disabled />);
    await user.click(screen.getByRole("button", { name: /^Download options/ }));
    expect(screen.getByRole("checkbox", { name: /Include videos/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Include backgrounds/ })).toBeDisabled();
    expect(
      screen.getByText("You can change these once the download, zip or torrent is done."),
    ).toBeInTheDocument();
  });
});
