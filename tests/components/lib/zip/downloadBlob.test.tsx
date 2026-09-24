/**
 * @file tests/components/lib/zip/downloadBlob.test.tsx
 * @desc downloadBlob clicks a temporary link and revokes the object URL later, not immediately.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/lib/zip/save-zip";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("clicks a temporary download link and revokes the URL a minute later", () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: () => "blob:fake", configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadBlob(new Blob(["x"]), "SPC Quals.zip");

    expect(clicked[0]?.download).toBe("SPC Quals.zip");
    expect(clicked[0]?.getAttribute("href")).toBe("blob:fake");
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});
