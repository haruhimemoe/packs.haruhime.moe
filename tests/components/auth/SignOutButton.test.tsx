/**
 * @file tests/components/auth/SignOutButton.test.tsx
 * @desc Signs out, then returns home and refreshes server components.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignOutButton } from "@/components/auth/SignOutButton";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

describe("SignOutButton", () => {
  it("signs out and goes home", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn(async () => undefined);
    render(<SignOutButton signOut={signOut} />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(signOut).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalled();
  });

  it("forgets the signed-in marker so the header flips without a reload", async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API; this seeds the marker.
    document.cookie = "packs-signed-in=1; Path=/";
    render(<SignOutButton signOut={vi.fn(async () => undefined)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(document.cookie).not.toContain("packs-signed-in=1"));
  });

  it("keeps the marker when signing out failed", async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API; this seeds the marker.
    document.cookie = "packs-signed-in=1; Path=/";
    render(<SignOutButton signOut={vi.fn(async () => Promise.reject(new Error("offline")))} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(document.cookie).toContain("packs-signed-in=1");
  });
});
