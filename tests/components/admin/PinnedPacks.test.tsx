/**
 * @file tests/components/admin/PinnedPacks.test.tsx
 * @desc /admin "Pinned packs" panel: the pins in order, moving one up or down (the whole new order
 *       goes to the server, focus stays with the pack), unpinning, the server's message when a
 *       change is refused, and the empty state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinnedPacks } from "@/components/admin/PinnedPacks";
import { PacksApiError } from "@/lib/packs-api";
import type { PinnedPack } from "@/schemas/public-pack";
import { PINS_CHANGED } from "@/utils/pins";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const pin = (slug: string, name: string): PinnedPack => ({
  slug,
  name,
  ownerName: "host",
  pinnedAt: "2026-09-24T10:00:00.000Z",
});

const A = pin("aaaaaaaaaa", "Spring Cup");
const B = pin("bbbbbbbbbb", "Summer Cup");
const C = pin("cccccccccc", "Autumn Cup");

/** The fake server answers with the pins in the order it was sent. */
const fakeApi = () => {
  const bySlug = new Map([A, B, C].map((p) => [p.slug, p]));
  return {
    reorderPins: vi.fn(async (slugs: readonly string[]) =>
      slugs.map((slug) => bySlug.get(slug) as PinnedPack),
    ),
    unpin: vi.fn(async (slug: string) => [A, B, C].filter((p) => p.slug !== slug)),
  };
};

const names = () =>
  within(screen.getByRole("list"))
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("PinnedPacks", () => {
  beforeEach(() => refresh.mockReset());

  it("lists the pins in order, linking each pack, with its host", () => {
    render(<PinnedPacks pins={[A, B, C]} api={fakeApi()} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pinned packs" })).toBeInTheDocument();
    expect(names()).toEqual(["Spring Cup", "Summer Cup", "Autumn Cup"]);
    expect(screen.getByRole("link", { name: "Spring Cup" })).toHaveAttribute(
      "href",
      "/p/aaaaaaaaaa",
    );
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("host");
    expect(screen.getByText(/in this order/)).toHaveTextContent("Up to 6");
  });

  it("offers no Move up on the first pin and no Move down on the last", () => {
    render(<PinnedPacks pins={[A, B, C]} api={fakeApi()} />);
    expect(screen.queryByRole("button", { name: "Move Spring Cup up" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Spring Cup down" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Summer Cup up" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move Autumn Cup down" })).not.toBeInTheDocument();
  });

  it("sends the whole new order when a pin moves, then refreshes the page", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<PinnedPacks pins={[A, B, C]} api={api} />);
    await user.click(screen.getByRole("button", { name: "Move Spring Cup down" }));
    expect(api.reorderPins).toHaveBeenCalledWith([B.slug, A.slug, C.slug]);
    expect(names()).toEqual(["Summer Cup", "Spring Cup", "Autumn Cup"]);
    expect(refresh).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Move Autumn Cup up" }));
    expect(api.reorderPins).toHaveBeenLastCalledWith([B.slug, C.slug, A.slug]);
  });

  it("keeps focus with the pack it moved, even when it reaches an end", async () => {
    const user = userEvent.setup();
    render(<PinnedPacks pins={[A, B, C]} api={fakeApi()} />);
    await user.click(screen.getByRole("button", { name: "Move Summer Cup down" }));
    expect(screen.getByRole("button", { name: "Move Summer Cup up" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Move Autumn Cup up" }));
    expect(screen.getByRole("button", { name: "Move Autumn Cup down" })).toHaveFocus();
  });

  it("unpins a pack and says so", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<PinnedPacks pins={[A, B, C]} api={api} />);
    await user.click(screen.getByRole("button", { name: "Unpin Summer Cup" }));
    expect(api.unpin).toHaveBeenCalledWith(B.slug);
    expect(names()).toEqual(["Spring Cup", "Autumn Cup"]);
    expect(screen.getByRole("status")).toHaveTextContent("Unpinned Summer Cup.");
    expect(screen.getByRole("status")).toHaveFocus();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the server's message when a change is refused, and keeps the order", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.reorderPins.mockRejectedValueOnce(new PacksApiError(PINS_CHANGED, 409));
    render(<PinnedPacks pins={[A, B]} api={api} />);
    await user.click(screen.getByRole("button", { name: "Move Spring Cup down" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(PINS_CHANGED);
    expect(names()).toEqual(["Spring Cup", "Summer Cup"]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("follows the page when it refreshes with other pins", () => {
    const { rerender } = render(<PinnedPacks pins={[A, B]} api={fakeApi()} />);
    rerender(<PinnedPacks pins={[C, A]} api={fakeApi()} />);
    expect(names()).toEqual(["Autumn Cup", "Spring Cup"]);
  });

  it("says how to pin a pack when nothing is pinned", () => {
    render(<PinnedPacks pins={[]} api={fakeApi()} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing is pinned/)).toBeInTheDocument();
  });
});
