import type { Metadata } from "next";
import { EmbedAware } from "@/components/erp/EmbedAware";
import { PiiPublisher } from "@/components/erp/PiiPublisher";
import { CLAIMS_TITLE } from "@/lib/claims-model";
import "./claims.css";

export const metadata: Metadata = { title: CLAIMS_TITLE };

/** Second sandbox app. Vision-only: it posts no telemetry, so capture of this app sees only what vision reads. */
export default function ClaimsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EmbedAware />
      <PiiPublisher />
      {children}
    </>
  );
}
