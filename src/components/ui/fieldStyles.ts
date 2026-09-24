/**
 * @file src/components/ui/fieldStyles.ts
 * @desc Shared classes for inputs, selects, and textareas (osu!-web dark fields).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { cn } from "@/utils/cn";

const FIELD =
  "w-full rounded-md border border-b3 bg-b6 px-3 py-2 text-c1 text-sm placeholder:text-c4 focus-visible:border-h1 focus-visible:outline-none disabled:opacity-50 aria-invalid:border-rose-400";

/**
 * @function fieldClasses
 * @param className {string} extra classes (win on conflict)
 * @returns {string} class string for a form control
 */
export const fieldClasses = (className?: string): string => cn(FIELD, className);
