/**
 * @file tests/components/auth/SignInWithOsu.test.tsx
 * @desc Starts osu! sign-in toward the given destination; shows failures.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignInWithOsu } from "@/components/auth/SignInWithOsu";

const { social } = vi.hoisted(() => ({ social: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { social } } }));

describe("SignInWithOsu", () => {
  it("asks better-auth for osu! sign-in by default", async () => {
    const user = userEvent.setup();
    social.mockResolvedValue({ data: { url: "https://osu.ppy.sh/oauth/authorize" }, error: null });
    render(<SignInWithOsu next="/new" />);
    await user.click(screen.getByRole("button", { name: "Sign in with osu!" }));
    expect(social).toHaveBeenCalledWith({
      provider: "osu",
      callbackURL: "/new",
      errorCallbackURL: "/signin?error=oauth",
    });
  });

  it("reports better-auth's error from the default sign-in", async () => {
    const user = userEvent.setup();
    social.mockResolvedValue({ data: null, error: { message: "Provider not found" } });
    render(<SignInWithOsu next="/new" />);
    await user.click(screen.getByRole("button", { name: "Sign in with osu!" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider not found");
  });

  it("starts sign-in toward next and waits for the redirect", async () => {
    const user = userEvent.setup();
    const start = vi.fn(() => new Promise<void>(() => undefined));
    render(<SignInWithOsu next="/new" start={start} />);
    await user.click(screen.getByRole("button", { name: "Sign in with osu!" }));
    expect(start).toHaveBeenCalledWith("/new");
    expect(screen.getByRole("button", { name: "Opening osu!…" })).toBeDisabled();
  });

  it("shows a failure and lets the person try again", async () => {
    const user = userEvent.setup();
    const start = vi.fn(async () => {
      throw new Error("osu! sign-in isn't set up.");
    });
    render(<SignInWithOsu next="/me" start={start} />);
    await user.click(screen.getByRole("button", { name: "Sign in with osu!" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("osu! sign-in isn't set up.");
    expect(screen.getByRole("button", { name: "Sign in with osu!" })).toBeEnabled();
  });
});
