/**
 * @file tests/components/pack/SlotBadge.test.tsx
 * @desc SlotBadge label, title and colors.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlotBadge } from "@/components/pack/SlotBadge";

describe("SlotBadge", () => {
  it("shows the slot label with the bucket's full name as its title", () => {
    render(<SlotBadge entry={{ code: "HD" }} index={2} />);
    expect(screen.getByText("HD2")).toHaveAttribute("title", "Hidden");
  });

  it("shows just the bucket without an index", () => {
    render(<SlotBadge entry={{ code: "TB" }} />);
    expect(screen.getByText("TB")).toHaveClass("bg-orange-400");
  });

  it("colors custom buckets from the palette", () => {
    render(<SlotBadge entry={{ code: "EZ", color: 0 }} index={1} />);
    expect(screen.getByText("EZ1")).toHaveClass("bg-green-400");
    expect(screen.getByText("EZ1")).toHaveAttribute("title", "EZ");
  });

  it("shows a grey number for no-slot maps", () => {
    render(<SlotBadge entry={null} index={3} />);
    expect(screen.getByText("3")).toHaveClass("bg-b3");
    expect(screen.getByText("3")).toHaveAttribute("title", "No slot");
  });
});
