import type { Metadata } from "next";
import { CompanyMapCanvas } from "@/components/platform/CompanyMapCanvas";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { loadPlatform } from "@/lib/platform/load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Company map · Tacit" };

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ role?: string | string[] }> }) {
  const sp = await searchParams;
  const role = typeof sp.role === "string" ? sp.role : null;
  const data = await loadPlatform();
  return (
    <PlatformShell data={data} active={{ page: "map", roleId: role }}>
      <CompanyMapCanvas data={data} initialRoleId={role} />
    </PlatformShell>
  );
}
