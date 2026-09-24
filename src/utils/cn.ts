/**
 * @file src/utils/cn.ts
 * @desc Class-name combiner: clsx for conditionals, tailwind-merge so later utilities win.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @function cn
 * @param inputs {ClassValue[]} class names, arrays, or conditional objects
 * @returns {string} merged class string with Tailwind conflicts resolved (last wins)
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
