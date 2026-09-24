/**
 * @file tests/components/pack/ShortLinkField.test.tsx
 * @desc Short link field: the /p/{slug} link on this origin, a Copy link button that says
 *       "Link copied.", and what to do when the clipboard refuses.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShortLinkField } from "@/components/pack/ShortLinkField";

describe("ShortLinkField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the link on this origin and copies it", async () => {
    const user = userEvent.setup();
    render(<ShortLinkField slug="abcdefghij" />);
    const link = `${window.location.origin}/p/abcdefghij`;
    expect(screen.getByLabelText("Short link")).toHaveValue(link);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(link);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied.");
  });

  it("says to copy by hand when the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<ShortLinkField slug="abcdefghij" />);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Couldn't copy. Select the link and copy it by hand.",
    );
  });
});
