/**
 * @file src/app/layout.tsx
 * @desc Root layout: Nunito font variable, site metadata, dark osu!-web body, the mounted
 *       command palette (AppPalette; its Ctrl K/Cmd K hotkey is page-global), and the library
 *       PageShell frame around the packs header and footer.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import { pwaMetadata, pwaViewport, ServiceWorkerRegister } from "@haruhimemoe/next-kit/pwa";
import { siteMetadata } from "@haruhimemoe/next-kit/seo";
import { PageShell } from "@haruhimemoe/ui";
import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { AppPalette } from "@/components/layout/AppPalette";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PWA } from "@/constants/pwa";
import { SEO_SITE } from "@/constants/seo";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

// No og:title/description here: Next fills them from each page's own. Pages that set their own
// openGraph (pageMetadata) carry the preview image themselves.
export const metadata: Metadata = { ...siteMetadata(SEO_SITE), ...pwaMetadata(PWA) };

/** The page color as the browser's theme color, the app's color scheme, zoom left on. */
export const viewport: Viewport = pwaViewport(PWA);

/**
 * @function RootLayout
 * @param props {{ children: ReactNode }} the page inside the site frame
 * @returns {JSX.Element} root layout
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="bg-b5 font-sans text-c2 antialiased">
        <AppPalette />
        <PageShell header={<Header />} footer={<Footer />}>
          {children}
        </PageShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
