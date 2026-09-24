/**
 * @file tests/unit/lib/storage/download-choices.test.ts
 * @desc Saved download options: defaults, round trip, junk, storage that throws, no storage.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import {
  type ChoicesStorage,
  clearDownloadChoices,
  DOWNLOAD_CHOICES_KEY,
  loadDownloadChoices,
  saveDownloadChoices,
} from "@/lib/storage/download-choices";
import { DEFAULT_DOWNLOAD_CHOICES } from "@/schemas/download-choices";

const memory = (initial?: string) => {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(DOWNLOAD_CHOICES_KEY, initial);
  const storage: ChoicesStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  return { map, storage };
};

const denied = (): never => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};
const throwing: ChoicesStorage = { getItem: denied, setItem: denied, removeItem: denied };

describe("download choices storage", () => {
  it("starts with no videos and backgrounds included", () => {
    expect(DEFAULT_DOWNLOAD_CHOICES).toEqual({ videos: false, backgrounds: true });
    expect(loadDownloadChoices(memory().storage)).toEqual(DEFAULT_DOWNLOAD_CHOICES);
  });

  it("saves and loads a choice under packs-download-options", () => {
    const { map, storage } = memory();
    saveDownloadChoices({ videos: true, backgrounds: false }, storage);
    expect(DOWNLOAD_CHOICES_KEY).toBe("packs-download-options");
    expect(JSON.parse(map.get(DOWNLOAD_CHOICES_KEY) ?? "null")).toEqual({
      videos: true,
      backgrounds: false,
    });
    expect(loadDownloadChoices(storage)).toEqual({ videos: true, backgrounds: false });
  });

  it.each(["not json", "null", '{"videos":"yes","backgrounds":true}', '{"videos":true}'])(
    "falls back to the defaults for %j",
    (junk) => {
      expect(loadDownloadChoices(memory(junk).storage)).toEqual(DEFAULT_DOWNLOAD_CHOICES);
    },
  );

  it("uses the defaults and never throws when storage refuses access", () => {
    expect(loadDownloadChoices(throwing)).toEqual(DEFAULT_DOWNLOAD_CHOICES);
    expect(() => saveDownloadChoices({ videos: true, backgrounds: true }, throwing)).not.toThrow();
    expect(() => clearDownloadChoices(throwing)).not.toThrow();
  });

  it("works where there is no browser storage at all", () => {
    expect(loadDownloadChoices()).toEqual(DEFAULT_DOWNLOAD_CHOICES);
    expect(() => saveDownloadChoices({ videos: true, backgrounds: true })).not.toThrow();
    expect(() => clearDownloadChoices(null)).not.toThrow();
  });

  it("clears the saved choice", () => {
    const { map, storage } = memory('{"videos":true,"backgrounds":true}');
    clearDownloadChoices(storage);
    expect(map.has(DOWNLOAD_CHOICES_KEY)).toBe(false);
  });
});
