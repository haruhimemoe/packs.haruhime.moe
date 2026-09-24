/**
 * @file tests/components/pack/KeyPasteForm.test.tsx
 * @desc Paste-a-key: validates before navigating, accepts keys inside links and sentences.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyPasteForm } from "@/components/pack/KeyPasteForm";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const KEY = encodePackKey({ name: "p", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] });

describe("KeyPasteForm", () => {
  beforeEach(() => {
    push.mockReset();
    window.history.replaceState(null, "", "/");
  });

  it("opens a key found inside a pasted sentence", async () => {
    const user = userEvent.setup();
    render(<KeyPasteForm />);
    await user.click(screen.getByLabelText("Pack key or link"));
    await user.paste(`pool: https://packs.haruhime.moe/k#${KEY}. gl`);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(push).toHaveBeenCalledWith(`/k#${KEY}`);
  });

  it("explains a bad key and stays put", async () => {
    const user = userEvent.setup();
    render(<KeyPasteForm />);
    await user.type(screen.getByLabelText("Pack key or link"), "hello{Enter}");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't look like a pack key/);
  });

  it("on /k, swaps the hash instead of pushing (Next doesn't fire hashchange)", async () => {
    window.history.replaceState(null, "", "/k");
    const user = userEvent.setup();
    render(<KeyPasteForm />);
    await user.type(screen.getByLabelText("Pack key or link"), `${KEY}{Enter}`);
    expect(push).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(`#${KEY}`);
  });
});
