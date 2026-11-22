import type { Metadata } from "next";
import type { ReactNode } from "react";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "McGill Martlet",
  description: "Discover spontaneous meetups around McGill.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme / data-mode are set before paint by themeInitScript (ADR 0012), so the server
    // markup and the client attributes can differ: suppress that one hydration warning.
    <html lang="en-CA" data-theme="classic" data-mode="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-canvas text-ink">{children}</body>
    </html>
  );
}
