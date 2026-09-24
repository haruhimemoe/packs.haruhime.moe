/**
 * @file tests/components/ui/Card.test.tsx
 * @desc Component tests for Card: titled cards are labelled regions, untitled cards have no heading.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "@/components/ui/Card";

describe("Card", () => {
  it("renders a titled card as a region named by its heading", () => {
    render(<Card title="Export anywhere">Zip, torrent, Drive, OneDrive.</Card>);
    expect(screen.getByRole("heading", { level: 2, name: "Export anywhere" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Export anywhere" })).toHaveTextContent(
      "Zip, torrent, Drive, OneDrive.",
    );
  });

  it("renders no heading without a title", () => {
    render(<Card>Body only</Card>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Body only")).toBeInTheDocument();
  });
});
