/**
 * @file tests/components/beatmap/StarRating.test.tsx
 * @desc StarRating pill: text, colour, screen-reader wording.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StarRating } from "@/components/beatmap/StarRating";

describe("StarRating", () => {
  it("reads as '<n> stars' and is coloured by difficulty", () => {
    const { container } = render(<StarRating value={7.8057} />);
    expect(container.textContent).toContain("7.81");
    expect(screen.getByText("stars")).toHaveClass("sr-only");
    expect(container.firstElementChild).toHaveStyle({ color: "#ffd966" });
  });
  it("carries an optional title", () => {
    const { container } = render(<StarRating value={6.02} title="5.80★ without mods" />);
    expect(container.firstElementChild).toHaveAttribute("title", "5.80★ without mods");
  });

  it("reads an optional label to screen readers after the stars", () => {
    const { container } = render(<StarRating value={6.02} label="with HD, 5.80 without mods" />);
    expect(screen.getByText("with HD, 5.80 without mods")).toHaveClass("sr-only");
    expect(container.firstElementChild).toHaveTextContent("6.02stars with HD, 5.80 without mods");
  });

  it("adds nothing for screen readers without a label", () => {
    const { container } = render(<StarRating value={6.02} />);
    expect(container.firstElementChild?.querySelectorAll(".sr-only")).toHaveLength(1);
  });
});
