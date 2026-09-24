/**
 * @file tests/components/admin/AdminScreen.test.tsx
 * @desc /admin body: filter tabs, name filter form, count, paging links keep the filters.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminScreen } from "@/components/admin/AdminScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("AdminScreen", () => {
  it("keeps the filters in tabs, the form, and page links", () => {
    render(<AdminScreen rows={[]} page={2} pageCount={3} total={120} hiddenOnly query="cup" />);
    expect(screen.getByRole("heading", { level: 1, name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/admin?q=cup");
    const hidden = screen.getByRole("link", { name: "Hidden" });
    expect(hidden).toHaveAttribute("href", "/admin?show=hidden&q=cup");
    expect(hidden).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Pack name")).toHaveValue("cup");
    expect(document.querySelector('input[name="show"]')).toHaveValue("hidden");
    expect(screen.getByText("120 packs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Newer" })).toHaveAttribute(
      "href",
      "/admin?show=hidden&q=cup",
    );
    expect(screen.getByRole("link", { name: "Older" })).toHaveAttribute(
      "href",
      "/admin?show=hidden&q=cup&page=3",
    );
  });
});
