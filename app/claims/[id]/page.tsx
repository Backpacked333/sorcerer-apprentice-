import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaimsShell } from "@/components/claims/ClaimsShell";
import { ClaimDetail } from "@/components/claims/ClaimDetail";
import { CLAIMS_TITLE, getClaim } from "@/lib/claims-model";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const claim = getClaim((await params).id);
  return { title: claim ? `${claim.id} · ${CLAIMS_TITLE}` : CLAIMS_TITLE };
}

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const claim = getClaim(decodeURIComponent((await params).id));
  if (!claim) notFound();
  return (
    <ClaimsShell crumbs={[{ label: "Claims", href: "/claims" }, { label: "My queue", href: "/claims" }, { label: claim.id }]}>
      <ClaimDetail key={claim.id} claim={claim} />
    </ClaimsShell>
  );
}
