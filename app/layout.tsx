import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AchievementToaster } from "@/components/achievements/AchievementToaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "McGill Martlet",
  description: "Discover spontaneous meetups around McGill.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA">
      <body>
        {children}
        <AchievementToaster />
      </body>
    </html>
  );
}
