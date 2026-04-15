import "./globals.css";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import { ReactNode } from "react";

import { GlobalPageTabs } from "@/components/navigation/global-page-tabs";
import { StudioProvider } from "@/components/studio/studio-provider";
import { getStudioAccess } from "@/lib/studio/access";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Homeschool V2",
  description: "A fresh restart for a planning-first homeschool platform.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Homeschool V2",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#bb6a3a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const studioAccess = getStudioAccess();

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${display.variable} ${body.variable} min-h-screen overflow-x-hidden bg-background text-foreground`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <StudioProvider access={studioAccess}>
          <GlobalPageTabs />
          {children}
        </StudioProvider>
      </body>
    </html>
  );
}
