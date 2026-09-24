/**
 * @file tests/components/export/DownloadProgress.test.tsx
 * @desc DownloadProgress: overall count and a readable line for every status.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadProgress } from "@/components/export/DownloadProgress";
import type { SetStatus } from "@/lib/downloads/fetch-sets";

const rows = [
  { key: "NM1", label: "NM1", title: "xi - FREEDOM DiVE", setId: 1 },
  { key: "NM2", label: "NM2", title: "a - b", setId: 2 },
  { key: "HD1", label: "HD1", title: "c - d", setId: 3 },
  { key: "HR1", label: "HR1", title: "e - f", setId: 4 },
  { key: "DT1", label: "DT1", title: "g - h", setId: 5 },
];
const statuses = new Map<number, SetStatus>([
  [1, { status: "downloading", loaded: 5, total: 10, attempt: 1 }],
  [2, { status: "waiting", retryInMs: 4200, attempt: 1 }],
  [3, { status: "ready", blob: new Blob(["x"]), fromCache: true }],
  [4, { status: "failed", message: "The mirror doesn't have this beatmapset.", retryable: false }],
  [5, { status: "downloading", loaded: 2048, total: null, attempt: 1 }],
]);

describe("DownloadProgress", () => {
  it("shows overall progress and every set's state", () => {
    render(<DownloadProgress rows={rows} statuses={statuses} />);
    const bar = screen.getByRole("progressbar", { name: "Download progress" });
    expect(bar).toHaveAttribute("value", "1");
    expect(bar).toHaveAttribute("max", "5");
    expect(screen.getByText("1 of 5 sets ready")).toBeInTheDocument();
    expect(screen.getByText("Downloading 50%")).toBeInTheDocument();
    expect(screen.getByText("Mirror is busy, retrying in 5s")).toBeInTheDocument();
    expect(screen.getByText("Ready (saved in this browser)")).toBeInTheDocument();
    expect(screen.getByText("The mirror doesn't have this beatmapset.")).toBeInTheDocument();
    expect(screen.getByText("Downloading 2.0 KB")).toBeInTheDocument();
  });

  it("says Waiting for sets that haven't started", () => {
    render(<DownloadProgress rows={rows.slice(0, 1)} statuses={new Map()} />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });

  it("says when backgrounds are being removed, or had to be kept", () => {
    render(
      <DownloadProgress
        rows={rows.slice(0, 3)}
        statuses={
          new Map<number, SetStatus>([
            [1, { status: "removing" }],
            [
              2,
              { status: "ready", blob: new Blob(["x"]), fromCache: false, backgroundsKept: true },
            ],
            [3, { status: "ready", blob: new Blob(["x"]), fromCache: true, backgroundsKept: true }],
          ])
        }
      />,
    );
    expect(screen.getByText("Removing backgrounds…")).toBeInTheDocument();
    expect(screen.getByText("Ready, backgrounds kept")).toBeInTheDocument();
    expect(screen.getByText("Ready (saved in this browser), backgrounds kept")).toBeInTheDocument();
  });
});
