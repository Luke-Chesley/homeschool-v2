import "./globals.css";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import { ReactNode } from "react";

import { GlobalPageTabs } from "@/components/navigation/global-page-tabs";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${display.variable} ${body.variable} min-h-screen overflow-x-hidden bg-background text-foreground [--global-tabs-height:4rem]`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <GlobalPageTabs />
        {children}
      </body>
    </html>
  );
}
