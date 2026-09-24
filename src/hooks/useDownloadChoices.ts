/**
 * @file src/hooks/useDownloadChoices.ts
 * @desc The Download card's download options as React state: the defaults on the first render (so
 *       server and client HTML match), the saved choice right after mount, saved on every change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { loadDownloadChoices, saveDownloadChoices } from "@/lib/storage/download-choices";
import { DEFAULT_DOWNLOAD_CHOICES, type DownloadChoices } from "@/schemas/download-choices";

/**
 * @function useDownloadChoices
 * @returns {[DownloadChoices, (next: DownloadChoices) => void]} the choice and a setter that saves
 */
export const useDownloadChoices = (): [DownloadChoices, (next: DownloadChoices) => void] => {
  const [choices, setChoices] = useState<DownloadChoices>(DEFAULT_DOWNLOAD_CHOICES);

  useEffect(() => {
    setChoices(loadDownloadChoices());
  }, []);

  const update = useCallback((next: DownloadChoices) => {
    setChoices(next);
    saveDownloadChoices(next);
  }, []);

  return [choices, update];
};
