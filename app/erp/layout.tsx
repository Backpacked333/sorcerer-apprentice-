import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { EmbedAware } from "@/components/erp/EmbedAware";
import { PiiPublisher } from "@/components/erp/PiiPublisher";
import "./erp.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = { title: "MB-ERP · Accounts payable" };

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`erp ${plex.variable}`}>
      <EmbedAware />
      <PiiPublisher />
      {children}
    </div>
  );
}
