/**
 * @file tests/components/hooks/useDownloadChoices.test.tsx
 * @desc useDownloadChoices: defaults, the saved choice after mount, saving a change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDownloadChoices } from "@/hooks/useDownloadChoices";
import { DOWNLOAD_CHOICES_KEY } from "@/lib/storage/download-choices";
import { DEFAULT_DOWNLOAD_CHOICES } from "@/schemas/download-choices";

beforeEach(() => {
  localStorage.clear();
});

describe("useDownloadChoices", () => {
  it("starts with the defaults when nothing is saved", () => {
    const { result } = renderHook(() => useDownloadChoices());
    expect(result.current[0]).toEqual(DEFAULT_DOWNLOAD_CHOICES);
  });

  it("loads the saved choice after mounting", async () => {
    localStorage.setItem(
      DOWNLOAD_CHOICES_KEY,
      JSON.stringify({ videos: true, backgrounds: false }),
    );
    const { result } = renderHook(() => useDownloadChoices());
    await waitFor(() => expect(result.current[0]).toEqual({ videos: true, backgrounds: false }));
  });

  it("saves a change", () => {
    const { result } = renderHook(() => useDownloadChoices());
    act(() => result.current[1]({ videos: true, backgrounds: true }));
    expect(result.current[0]).toEqual({ videos: true, backgrounds: true });
    expect(JSON.parse(localStorage.getItem(DOWNLOAD_CHOICES_KEY) ?? "null")).toEqual({
      videos: true,
      backgrounds: true,
    });
  });
});
