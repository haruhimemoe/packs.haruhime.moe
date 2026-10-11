/**
 * @file src/i18n/request.ts
 * @desc next-intl's request config: prefix-less locales (the shared NEXT_LOCALE cookie, then
 *       Accept-Language; nothing is read while English is the only locale, so pages stay static)
 *       and the ui, common and packs catalogs from @haruhimemoe/messages, English filling any gap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { LOCALES, messagesLoader } from "@haruhimemoe/messages";
import { createRequestConfig, readRequestLocale } from "@haruhimemoe/next-kit/i18n/next-intl";

/** Every locale the catalogs carry, English first and the default. */
export const LOCALE_CONFIG = { locales: LOCALES, defaultLocale: "en" };

export default createRequestConfig({
  config: LOCALE_CONFIG,
  packages: [messagesLoader("ui"), messagesLoader("common")],
  app: messagesLoader("packs"),
  request: readRequestLocale,
});
