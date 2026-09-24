/**
 * @file src/hooks/useSettledValue.ts
 * @desc A value that follows another once it stops changing for a while. The /packs result
 *       count goes through it, so a live region announces where a slider drag or a burst of
 *       typing ends up instead of every step on the way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useEffect, useState } from "react";

/**
 * @function useSettledValue
 * @param value {T} the value that changes
 * @param delay {number} quiet time in milliseconds before the settled value catches up
 * @returns {T} `value` as it was when it last held still for `delay`; `value` on the first render
 */
export const useSettledValue = <T>(value: T, delay: number): T => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
};
