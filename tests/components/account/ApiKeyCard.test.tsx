/**
 * @file tests/components/account/ApiKeyCard.test.tsx
 * @desc The /me API key card: empty, one-time reveal, regenerate and revoke confirms, errors.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyCard } from "@/components/account/ApiKeyCard";
import { PacksApiError } from "@/lib/packs-api";
import type { ApiKeyInfo } from "@/schemas/api";

const INFO: ApiKeyInfo = {
  prefix: "hpk_AbCdEfGh",
  createdAt: "2026-09-20T10:00:00.000Z",
  lastUsedAt: null,
};
const NEW_KEY = `hpk_${"Z".repeat(43)}`;
const NEW_INFO: ApiKeyInfo = {
  prefix: "hpk_ZZZZZZZZ",
  createdAt: "2026-09-22T12:00:00.000Z",
  lastUsedAt: null,
};
const created = () => vi.fn(async () => ({ key: NEW_KEY, apiKey: NEW_INFO }));

describe("ApiKeyCard", () => {
  it("offers to create a key and links the docs", () => {
    render(<ApiKeyCard initial={null} createKey={created()} revokeKey={vi.fn()} />);
    expect(screen.getByRole("region", { name: "API key" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create API key" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the API docs" })).toHaveAttribute(
      "href",
      "/docs/api",
    );
  });

  it("shows a new key once, then only its prefix", async () => {
    const user = userEvent.setup();
    const createKey = created();
    render(<ApiKeyCard initial={null} createKey={createKey} revokeKey={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    expect(createKey).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("Copy your key now. You won't see it again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your new API key" })).toHaveValue(NEW_KEY);

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe(NEW_KEY);
    expect(screen.getByText("Key copied.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(NEW_KEY)).not.toBeInTheDocument();
    expect(screen.getByText("hpk_ZZZZZZZZ…")).toBeInTheDocument();
  });

  it("sends one create for two clicks in the same frame", async () => {
    const createKey = created();
    render(<ApiKeyCard initial={null} createKey={createKey} revokeKey={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Create API key" });
    await act(async () => {
      button.click();
      button.click();
    });
    expect(createKey).toHaveBeenCalledOnce();
  });

  it("shows the prefix and dates of an existing key", () => {
    const { rerender } = render(
      <ApiKeyCard initial={INFO} createKey={created()} revokeKey={vi.fn()} />,
    );
    expect(screen.getByText("hpk_AbCdEfGh…")).toBeInTheDocument();
    expect(screen.getByText(/Created Sep 20, 2026\. Not used yet\./)).toBeInTheDocument();
    rerender(
      <ApiKeyCard
        key="used"
        initial={{ ...INFO, lastUsedAt: "2026-09-22T08:00:00.000Z" }}
        createKey={created()}
        revokeKey={vi.fn()}
      />,
    );
    expect(screen.getByText(/Last used Sep 22, 2026\./)).toBeInTheDocument();
  });

  it("asks before regenerating, and Keep it cancels", async () => {
    const user = userEvent.setup();
    const createKey = created();
    render(<ApiKeyCard initial={INFO} createKey={createKey} revokeKey={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(screen.getByText("Your current key stops working right away.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(createKey).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    await user.click(screen.getByRole("button", { name: "Yes, regenerate" }));
    expect(createKey).toHaveBeenCalledOnce();
    expect(await screen.findByRole("textbox", { name: "Your new API key" })).toHaveValue(NEW_KEY);
  });

  it("asks before revoking, then offers a new key", async () => {
    const user = userEvent.setup();
    const revokeKey = vi.fn(async () => undefined);
    render(<ApiKeyCard initial={INFO} createKey={created()} revokeKey={revokeKey} />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(
      screen.getByText("Revoke this key? Anything using it stops working right away."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(revokeKey).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Yes, revoke" }));
    expect(revokeKey).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Create API key" })).toBeInTheDocument();
  });

  it("shows the server's message when creating fails", async () => {
    const user = userEvent.setup();
    const createKey = vi.fn(async () => {
      throw new PacksApiError("Too many requests. Try again in 40 minutes.", 429);
    });
    render(<ApiKeyCard initial={null} createKey={createKey} revokeKey={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many requests. Try again in 40 minutes.",
    );
    expect(screen.getByRole("button", { name: "Create API key" })).toBeEnabled();
  });

  it("moves focus to the revealed key and announces creation", async () => {
    const user = userEvent.setup();
    render(<ApiKeyCard initial={null} createKey={created()} revokeKey={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    const field = await screen.findByRole("textbox", { name: "Your new API key" });
    expect(field).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "API key created. Copy it now; it won't be shown again.",
    );
  });

  it("moves focus to Regenerate and announces saving, after I've saved it", async () => {
    const user = userEvent.setup();
    render(<ApiKeyCard initial={null} createKey={created()} revokeKey={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    await screen.findByRole("textbox", { name: "Your new API key" });
    await user.click(screen.getByRole("button", { name: "I've saved it" }));
    const regenerate = await screen.findByRole("button", { name: "Regenerate" });
    expect(regenerate).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Key saved.");
  });

  it("moves focus into the confirm, and back to Regenerate on Keep it", async () => {
    const user = userEvent.setup();
    render(<ApiKeyCard initial={INFO} createKey={created()} revokeKey={vi.fn()} />);
    const regenerate = screen.getByRole("button", { name: "Regenerate" });
    await user.click(regenerate);
    expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.getByRole("button", { name: "Regenerate" })).toHaveFocus();
  });

  it("moves focus to Create API key and announces revocation, after Yes, revoke", async () => {
    const user = userEvent.setup();
    const revokeKey = vi.fn(async () => undefined);
    render(<ApiKeyCard initial={INFO} createKey={created()} revokeKey={revokeKey} />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Yes, revoke" }));
    const createButton = await screen.findByRole("button", { name: "Create API key" });
    expect(createButton).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("API key revoked.");
  });
});
