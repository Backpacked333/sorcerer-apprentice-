import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { RoleEmpty, RoleMemoryView } from "@/components/platform/RoleMemoryView";
import { loadRole } from "@/lib/platform/load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Role memory · Simon" };

export default async function RolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const { data, role } = await loadRole(decodeURIComponent(roleId));
  return (
    <PlatformShell data={data} active={{ page: "memory", roleId: role?.roleId ?? roleId }} openAt={1320} scroll>
      {role ? <RoleMemoryView role={role} /> : <RoleEmpty title="Simon has no memory for this role yet" href="/platform" />}
    </PlatformShell>
  );
}
