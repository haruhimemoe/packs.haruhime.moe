/**
 * @file src/app/layout.tsx
 * @desc Root layout: Nunito font variable, site metadata, dark osu!-web body, PageShell frame.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { SITE } from "@/constants/site";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s · ${SITE.title}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_US",
    // No title/description here: Next then fills og:title/description from each page's own.
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="bg-b5 font-sans text-c2 antialiased">
        <PageShell>{children}</PageShell>
      </body>
    </html>
  );
}
