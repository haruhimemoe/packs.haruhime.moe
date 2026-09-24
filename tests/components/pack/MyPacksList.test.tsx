/**
 * @file tests/components/pack/MyPacksList.test.tsx
 * @desc /me pack list: empty state, an empty page past the end, and rows.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyPacksList } from "@/components/pack/MyPacksList";

describe("MyPacksList", () => {
  it("points an empty account at the builder", () => {
    render(<MyPacksList packs={[]} total={0} />);
    expect(screen.getByText("You haven't saved any packs yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Build a pack" })).toHaveAttribute("href", "/new");
  });

  it("links an empty page past the end back to the first page", () => {
    render(<MyPacksList packs={[]} total={3} />);
    expect(screen.getByText("There are no packs on this page.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to your newest packs" })).toHaveAttribute(
      "href",
      "/me",
    );
  });

  it("lists packs with size, visibility, and last update", () => {
    render(
      <MyPacksList
        packs={[
          {
            slug: "abcdefghij",
            name: "Finals",
            slotCount: 3,
            visibility: "unlisted",
            updatedAt: "2026-09-22T23:30:00.000Z",
          },
          {
            slug: "bcdefghijk",
            name: "Quals",
            slotCount: 1,
            visibility: "private",
            updatedAt: "2026-09-20T10:00:00.000Z",
          },
        ]}
        total={2}
      />,
    );
    expect(screen.getByRole("link", { name: "Finals" })).toHaveAttribute("href", "/p/abcdefghij");
    expect(screen.getByText("3 maps · Unlisted · Updated Sep 22, 2026")).toBeInTheDocument();
    expect(screen.getByText("1 map · Private · Updated Sep 20, 2026")).toBeInTheDocument();
  });

  it("marks packs a moderator hid", () => {
    render(
      <MyPacksList
        packs={[
          {
            slug: "abcdefghij",
            name: "Finals",
            slotCount: 3,
            visibility: "public",
            hidden: true,
            updatedAt: "2026-09-22T23:30:00.000Z",
          },
        ]}
        total={1}
      />,
    );
    expect(screen.getByText("3 maps · Public · Hidden · Updated Sep 22, 2026")).toBeInTheDocument();
  });
});
