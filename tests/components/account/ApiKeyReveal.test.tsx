/**
 * @file tests/components/account/ApiKeyReveal.test.tsx
 * @desc ApiKeyReveal: the key field on CopyField, the Copy button described by the field's label,
 *       the ref reaching the input, and "I've saved it".
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ApiKeyReveal } from "@/components/account/ApiKeyReveal";

describe("ApiKeyReveal", () => {
  it("shows the key, copies it, and describes the Copy button by the field's label", async () => {
    const user = userEvent.setup();
    render(<ApiKeyReveal apiKey="hk_test" onSaved={() => undefined} />);
    expect(screen.getByLabelText("Your new API key")).toHaveValue("hk_test");
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button).toHaveAccessibleDescription("Your new API key");
    await user.click(button);
    expect(await navigator.clipboard.readText()).toBe("hk_test");
    expect(screen.getByRole("status")).toHaveTextContent("Key copied.");
  });

  it("reaches the input through inputRef", () => {
    const inputRef = createRef<HTMLInputElement>();
    render(<ApiKeyReveal apiKey="hk_test" onSaved={() => undefined} inputRef={inputRef} />);
    expect(inputRef.current).toBe(screen.getByLabelText("Your new API key"));
  });

  it("calls onSaved from I've saved it", async () => {
    const user = userEvent.setup();
    let saved = false;
    render(<ApiKeyReveal apiKey="hk_test" onSaved={() => (saved = true)} />);
    await user.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(saved).toBe(true);
  });
});
