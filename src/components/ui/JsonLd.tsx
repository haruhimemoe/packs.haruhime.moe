/**
 * @file src/components/ui/JsonLd.tsx
 * @desc schema.org structured data as a JSON-LD script tag.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { jsonLdString } from "@/utils/json-ld";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be raw JSON; jsonLdString escapes "<".
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}
