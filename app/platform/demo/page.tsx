import type { Metadata } from "next";
import { CompanyMapCanvas } from "@/components/platform/CompanyMapCanvas";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { demoPlatform } from "@/lib/platform/demo-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Company map (demo) · Simon" };

export default async function DemoPlatformPage({ searchParams }: { searchParams: Promise<{ role?: string | string[] }> }) {
  const sp = await searchParams;
  const role = typeof sp.role === "string" ? sp.role : null;
  const data = demoPlatform();
  return (
    <PlatformShell data={data} active={{ page: "map", roleId: role }}>
      <CompanyMapCanvas data={data} initialRoleId={role} />
    </PlatformShell>
  );
}
