/**
 * @file tests/components/ui/Button.test.tsx
 * @desc Component tests for Button: defaults, variants, disabled state, focus ring, clicks.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("defaults to type=button so it never submits a surrounding form", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("uses the accent background for the primary variant by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-h2", "rounded-full");
  });

  it("applies the secondary variant and merges a caller className last", () => {
    render(
      <Button variant="secondary" className="px-10">
        Alt
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-b3", "px-10");
    expect(button).not.toHaveClass("px-4");
  });

  it("has a visible keyboard focus ring", () => {
    render(<Button>Focus</Button>);
    expect(screen.getByRole("button")).toHaveClass("focus-visible:outline-2");
  });

  it("calls onClick, and not when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Click
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps disabled buttons hoverable for the cursor and tooltips, without lighting up", () => {
    render(
      <Button disabled title="Not yet">
        Wait
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("disabled:cursor-not-allowed", "disabled:opacity-50");
    expect(button).not.toHaveClass("disabled:pointer-events-none");
    expect(button).toHaveClass("not-disabled:hover:bg-h1");
    expect(button).not.toHaveClass("hover:bg-h1");
  });
});
