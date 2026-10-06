/**
 * @file src/mdx-components.tsx
 * @desc Global MDX element overrides (required by @next/mdx in the App Router): shared
 *       @haruhimemoe/ui element overrides (links, heading anchors, callouts, tables, highlighted
 *       code blocks) plus next-kit's legal blocks, bound to packs' own `LEGAL_SITE` config so
 *       content/legal/*.mdx can write `<LegalContact />`, `<Processors />` and so on with no
 *       props. Registers Shiki highlighting as a side effect for the fenced code blocks in
 *       content/docs/api.mdx.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import {
  Changes,
  DataWeKeep,
  DmcaNotice,
  LegalContact,
  NoWarranty,
  Processors,
  YourRights,
} from "@haruhimemoe/next-kit/legal";
import { mdxComponents } from "@haruhimemoe/ui/mdx";
import "@haruhimemoe/ui/shiki";
import type { MDXComponents } from "mdx/types";
import { LEGAL_SITE } from "@/constants/legal-site";

/** next-kit's legal blocks, pre-bound to `LEGAL_SITE` so legal MDX writes them prop-free. */
const legalComponents: MDXComponents = {
  LegalContact: () => <LegalContact site={LEGAL_SITE} />,
  DataWeKeep: () => <DataWeKeep site={LEGAL_SITE} />,
  Processors: () => <Processors site={LEGAL_SITE} />,
  YourRights: () => <YourRights site={LEGAL_SITE} />,
  DmcaNotice: () => <DmcaNotice site={LEGAL_SITE} />,
  NoWarranty: () => <NoWarranty site={LEGAL_SITE} />,
  Changes: () => <Changes site={LEGAL_SITE} />,
};

/**
 * @function useMDXComponents
 * @param components {MDXComponents} app-only overrides passed in by callers, if any
 * @returns {MDXComponents} the components MDX pages render with (Next.js asks for this file)
 */
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...mdxComponents, ...legalComponents, ...components };
}
