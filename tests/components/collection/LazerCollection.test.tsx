/**
 * @file tests/components/collection/LazerCollection.test.tsx
 * @desc The osu!lazer side of the card when building the zip fails with a code other than
 *       invalid_name: the message is about the zip and shows the code, never the osu!stable side's
 *       advice about picking a file. The zip builder is mocked, since a real name can't reach these
 *       codes today.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { CollectionDbError } from "@haruhimemoe/osu/collections";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LazerCollection } from "@/components/collection/LazerCollection";
import { MD5_A, MD5_ABC } from "../../helpers/collections";

const { lazerCollectionZip } = vi.hoisted(() => ({ lazerCollectionZip: vi.fn() }));
vi.mock("@/lib/collections/collection-files", () => ({ lazerCollectionZip }));

describe("LazerCollection", () => {
  it.each(["too_large", "invalid_hash", "some_new_code"])(
    "says the zip couldn't be built for %s, with the code and no file advice",
    async (code) => {
      lazerCollectionZip.mockImplementationOnce(() => {
        throw new CollectionDbError(code, "x");
      });
      const user = userEvent.setup();
      const download = vi.fn();
      render(
        <LazerCollection packName="SPC Quals" hashes={[MD5_A, MD5_ABC]} download={download} />,
      );
      await user.click(screen.getByRole("button", { name: "Download zip for osu!lazer" }));
      expect(download).not.toHaveBeenCalled();
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(`Couldn't build the zip (${code}). Try again.`);
      expect(alert).not.toHaveTextContent(/collection\.db|osu!\.db|scores\.db/);
    },
  );
});
