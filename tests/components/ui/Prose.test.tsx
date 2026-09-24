/**
 * @file tests/components/ui/Prose.test.tsx
 * @desc Prose wrapper renders children and merges className.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Prose } from "@/components/ui/Prose";

describe("Prose", () => {
  it("wraps children and merges a caller className", () => {
    render(
      <Prose className="mt-8">
        <h2>Section</h2>
      </Prose>,
    );
    const heading = screen.getByRole("heading", { name: "Section" });
    expect(heading.parentElement).toHaveClass("mt-8", "max-w-3xl");
  });

  it("styles h2, inline code, and tables", () => {
    render(
      <Prose>
        <p>x</p>
      </Prose>,
    );
    const wrapper = screen.getByText("x").parentElement;
    expect(wrapper).toHaveClass(
      "[&_h2]:text-2xl",
      "[&_code]:rounded",
      "[&_table]:w-full",
      "[&_pre]:overflow-x-auto",
    );
  });
});
