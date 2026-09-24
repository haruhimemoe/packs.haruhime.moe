/**
 * @file tests/components/admin/PackStatsBackfill.test.tsx
 * @desc The /admin stats button: runs one batch, announces what it updated and what's left, can
 *       run again, is busy while it works, and shows the server's message when it fails.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PackStatsBackfill } from "@/components/admin/PackStatsBackfill";
import { PacksApiError } from "@/lib/packs-api";

describe("PackStatsBackfill", () => {
  it("runs a batch and announces the counts", async () => {
    const fillPackStats = vi
      .fn()
      .mockResolvedValueOnce({ updated: 25, remaining: 40 })
      .mockResolvedValueOnce({ updated: 1, remaining: 0 });
    render(<PackStatsBackfill api={{ fillPackStats }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pack stats" })).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(status).toHaveTextContent("Updated 25 packs. 40 still need stats.");

    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(status).toHaveTextContent("Updated 1 pack. Every pack has stats.");
    expect(fillPackStats).toHaveBeenCalledTimes(2);
  });

  it("is busy while the batch runs", async () => {
    let finish: (value: { updated: number; remaining: number }) => void = () => {};
    const fillPackStats = vi.fn(
      () =>
        new Promise<{ updated: number; remaining: number }>((resolve) => {
          finish = resolve;
        }),
    );
    render(<PackStatsBackfill api={{ fillPackStats }} />);
    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(screen.getByRole("button", { name: "Filling in stats…" })).toBeDisabled();
    finish({ updated: 0, remaining: 1 });
    expect(await screen.findByRole("button", { name: "Fill in stats" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Updated 0 packs. 1 still needs stats.");
  });

  it("shows the server's message when it fails", async () => {
    const fillPackStats = vi.fn().mockRejectedValue(new PacksApiError("Not found.", 404));
    render(<PackStatsBackfill api={{ fillPackStats }} />);
    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found.");
  });

  it("falls back to plain words for other failures", async () => {
    const fillPackStats = vi.fn().mockRejectedValue(new Error("boom"));
    render(<PackStatsBackfill api={{ fillPackStats }} />);
    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again.");
  });
});
