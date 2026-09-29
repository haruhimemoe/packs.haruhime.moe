/**
 * @file src/app/layout.tsx
 * @desc Root layout: Nunito font variable, site metadata, dark osu!-web body, and the library
 *       PageShell frame around the packs header and footer.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { siteMetadata } from "@haruhimemoe/next-kit/seo";
import { PageShell } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SEO_SITE } from "@/constants/seo";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

// No og:title/description here: Next fills them from each page's own. Pages that set their own
// openGraph (pageMetadata) carry the preview image themselves.
export const metadata: Metadata = siteMetadata(SEO_SITE);

/**
 * @function RootLayout
 * @param props {{ children: ReactNode }} the page inside the site frame
 * @returns {JSX.Element} root layout
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="bg-b5 font-sans text-c2 antialiased">
        <PageShell header={<Header />} footer={<Footer />}>
          {children}
        </PageShell>
      </body>
    </html>
  );
}
