import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AchievementToaster } from "@/components/achievements/AchievementToaster";
import { FooterVisibility } from "@/components/layout/FooterVisibility";
import { MartletFooter } from "@/components/layout/MartletFooter";
import { FlyingMartlet } from "@/components/martlet/FlyingMartlet";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "McGill Martlet",
  description: "Discover spontaneous meetups around McGill.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme / data-mode are set before paint by themeInitScript (ADR 0014), so the server
    // markup and the client attributes can differ: suppress that one hydration warning.
    <html lang="en-CA" data-theme="classic" data-mode="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-canvas text-ink">
        <div className="martlet-page grid min-w-0 flex-1">{children}</div>
        <FooterVisibility><MartletFooter /></FooterVisibility>
        <FlyingMartlet />
        <AchievementToaster />
      </body>
    </html>
  );
}
