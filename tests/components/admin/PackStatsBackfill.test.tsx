/**
 * @file tests/components/admin/PackStatsBackfill.test.tsx
 * @desc The /admin stats button: runs one batch, announces what it updated, what's left and what
 *       waits for a retry, can run again, is busy while it works, and shows the server's message
 *       when it fails.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PackStatsBackfill } from "@/components/admin/PackStatsBackfill";
import { PacksApiError } from "@/lib/packs-api";
import type { PackStatsJob } from "@/schemas/pack-stats";

describe("PackStatsBackfill", () => {
  it("runs a batch and announces the counts", async () => {
    const fillPackStats = vi
      .fn()
      .mockResolvedValueOnce({ updated: 25, remaining: 40, waiting: 0 })
      .mockResolvedValueOnce({ updated: 1, remaining: 0, waiting: 0 });
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

  it("says how many packs wait to retry lookups that failed", async () => {
    const fillPackStats = vi
      .fn()
      .mockResolvedValueOnce({ updated: 25, remaining: 3, waiting: 1 })
      .mockResolvedValueOnce({ updated: 3, remaining: 0, waiting: 4 });
    render(<PackStatsBackfill api={{ fillPackStats }} />);
    const status = screen.getByRole("status");

    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(status).toHaveTextContent(
      "Updated 25 packs. 3 still need stats. 1 more is missing some details and will be tried again later.",
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(status).toHaveTextContent(
      "Updated 3 packs. Nothing else is due. 4 packs are missing some details and will be tried again later.",
    );
  });

  it("is busy while the batch runs", async () => {
    let finish: (value: PackStatsJob) => void = () => {};
    const fillPackStats = vi.fn(
      () =>
        new Promise<PackStatsJob>((resolve) => {
          finish = resolve;
        }),
    );
    render(<PackStatsBackfill api={{ fillPackStats }} />);
    await userEvent.click(screen.getByRole("button", { name: "Fill in stats" }));
    expect(screen.getByRole("button", { name: "Filling in stats…" })).toBeDisabled();
    finish({ updated: 0, remaining: 1, waiting: 0 });
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
