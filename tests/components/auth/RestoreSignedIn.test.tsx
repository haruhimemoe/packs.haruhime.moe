/**
 * @file tests/components/auth/RestoreSignedIn.test.tsx
 * @desc Pages that know the user is signed in restore the header (and the signed-in marker) for
 *       sessions that have no marker yet, and /signin then continues to `next`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RestoreSignedIn } from "@/components/auth/RestoreSignedIn";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

const store = () => ({ recheck: vi.fn(async () => undefined) });

describe("RestoreSignedIn", () => {
  it("rechecks the session, then continues to next", async () => {
    const fake = store();
    render(<RestoreSignedIn next="/me" store={fake} readCookie={() => ""} />);
    expect(screen.getByText("Signing you in…")).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/me"));
    expect(fake.recheck).toHaveBeenCalledOnce();
  });

  it("rechecks quietly on a signed-in page when the marker is missing", async () => {
    const fake = store();
    const { container } = render(<RestoreSignedIn store={fake} readCookie={() => ""} />);
    await waitFor(() => expect(fake.recheck).toHaveBeenCalledOnce());
    expect(container).toBeEmptyDOMElement();
  });

  it("does nothing on a signed-in page when the marker is already there", () => {
    const fake = store();
    render(<RestoreSignedIn store={fake} readCookie={() => "packs-signed-in=1"} />);
    expect(fake.recheck).not.toHaveBeenCalled();
  });
});
