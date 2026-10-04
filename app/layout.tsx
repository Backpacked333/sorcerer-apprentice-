import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });

export const metadata: Metadata = {
  title: "Simon · the AI Apprentice",
  description: "Captures what an expert knows while they work, maps it, teaches it.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f4f7",
};

// No Tacit chrome here: this layout also wraps the sandbox ERP (app/erp).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} style={{ colorScheme: "light" }}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
