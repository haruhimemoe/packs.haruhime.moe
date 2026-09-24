/**
 * @file tests/components/pack/PackKeyField.test.tsx
 * @desc Pack key display and copy buttons (key and share link with the key in the fragment).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PackKeyField } from "@/components/pack/PackKeyField";

describe("PackKeyField", () => {
  it("shows the key and copies it", async () => {
    const user = userEvent.setup();
    render(<PackKeyField packKey="pk1.AbC" />);
    expect(screen.getByLabelText("Pack key")).toHaveValue("pk1.AbC");
    await user.click(screen.getByRole("button", { name: "Copy key" }));
    expect(await navigator.clipboard.readText()).toBe("pk1.AbC");
    expect(screen.getByRole("status")).toHaveTextContent("Key copied.");
  });

  it("copies a share link with the key after #", async () => {
    const user = userEvent.setup();
    render(<PackKeyField packKey="pk1.AbC" />);
    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/k#pk1.AbC`);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied.");
  });
});
