import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AchievementToaster } from "@/components/achievements/AchievementToaster";
import { FooterVisibility } from "@/components/layout/FooterVisibility";
import { MartletFooter } from "@/components/layout/MartletFooter";
import { FlyingMartlet } from "@/components/martlet/FlyingMartlet";
import { SeasonalScene } from "@/components/seasons/SeasonalScene";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// Collegiate editorial type (issue #16): self-hosted by next/font at build time.
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading", display: "swap", axes: ["opsz", "SOFT"] });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "McGill Martlet",
  description: "Discover spontaneous meetups around McGill.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme / data-mode are set before paint by themeInitScript (ADR 0014), so the server
    // markup and the client attributes can differ: suppress that one hydration warning.
    <html lang="en-CA" data-theme="classic" data-mode="light" suppressHydrationWarning className={`${heading.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-canvas font-sans text-ink antialiased">
        <div className="martlet-page grid min-w-0 flex-1">{children}</div>
        <FooterVisibility><MartletFooter /></FooterVisibility>
        <SeasonalScene />
        <FlyingMartlet />
        <AchievementToaster />
      </body>
    </html>
  );
}
