/**
 * @file tests/components/docs/CopyMarkdownButton.test.tsx
 * @desc "Copy as Markdown": copies the text it was given, says so in its status, says what to do
 *       when the clipboard refuses, and links the .md URL.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyMarkdownButton } from "@/components/docs/CopyMarkdownButton";

const MARKDOWN = "# packs API\n\nBody\n";

describe("CopyMarkdownButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies the Markdown and says Copied.", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<CopyMarkdownButton markdown={MARKDOWN} href="/docs/api.md" />);
    await user.click(screen.getByRole("button", { name: "Copy as Markdown" }));
    expect(writeText).toHaveBeenCalledWith(MARKDOWN);
    expect(screen.getByRole("status")).toHaveTextContent("Copied.");
  });

  it("points to the Markdown when the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<CopyMarkdownButton markdown={MARKDOWN} href="/docs/api.md" />);
    await user.click(screen.getByRole("button", { name: "Copy as Markdown" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Couldn't copy. Open the Markdown instead.",
    );
  });

  it("links the .md URL", () => {
    render(<CopyMarkdownButton markdown={MARKDOWN} href="/docs/api.md" />);
    expect(screen.getByRole("link", { name: "View as Markdown" })).toHaveAttribute(
      "href",
      "/docs/api.md",
    );
  });
});
