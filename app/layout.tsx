import "./globals.css";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { ReactNode } from "react";

import { GlobalPageTabs } from "@/components/navigation/global-page-tabs";

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
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} min-h-screen overflow-x-hidden bg-background text-foreground [--global-tabs-height:4rem]`}
      >
        <GlobalPageTabs />
        {children}
      </body>
    </html>
  );
}
