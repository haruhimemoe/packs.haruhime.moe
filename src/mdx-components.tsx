/**
 * @file src/mdx-components.tsx
 * @desc Global MDX element overrides (required by @next/mdx in the App Router): shared
 *       @haruhimemoe/ui element overrides (links, heading anchors, callouts, tables, highlighted
 *       code blocks). Registers Shiki highlighting as a side effect for the fenced code blocks in
 *       content/docs/api.mdx.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Fri Oct 3, 2026
 */

import { mdxComponents } from "@haruhimemoe/ui/mdx";
import "@haruhimemoe/ui/shiki";
import type { MDXComponents } from "mdx/types";

/**
 * @function useMDXComponents
 * @param components {MDXComponents} app-only overrides passed in by callers, if any
 * @returns {MDXComponents} the components MDX pages render with (Next.js asks for this file)
 */
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...mdxComponents, ...components };
}
