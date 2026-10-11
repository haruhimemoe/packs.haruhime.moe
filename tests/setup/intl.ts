/**
 * @file tests/setup/intl.ts
 * @desc Setup for every project: next-intl outside Next. useTranslations and getTranslations
 *       translate from the English catalogs of @haruhimemoe/messages, so components and pages
 *       render what the site shows in English.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { beforeAll, vi } from "vitest";

// next-intl outside Next: useTranslations and getTranslations translate from the English
// catalogs of @haruhimemoe/messages, so components render what the site shows in English.
const intl = vi.hoisted(() => ({ messages: {} as Record<string, unknown> }));
vi.mock("next-intl", async (original) => {
  const actual = await original<typeof import("next-intl")>();
  const translator = (namespace?: string) =>
    actual.createTranslator({ locale: "en", messages: intl.messages, namespace } as never);
  return {
    ...actual,
    useTranslations: translator,
    useLocale: () => "en",
    NextIntlClientProvider: ({ children }: { children: unknown }) => children,
  };
});
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (namespace?: string | { namespace?: string }) =>
      createTranslator({
        locale: "en",
        messages: intl.messages,
        namespace: typeof namespace === "string" ? namespace : namespace?.namespace,
      } as never),
    getLocale: async () => "en",
  };
});
beforeAll(async () => {
  const { loadMessages, NAMESPACES } = await import("@haruhimemoe/messages");
  for (const namespace of NAMESPACES)
    Object.assign(intl.messages, await loadMessages("en", namespace));
});
