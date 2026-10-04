import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { RoleMemoryView } from "@/components/platform/RoleMemoryView";
import { demoRole } from "@/lib/platform/demo-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Role memory (demo) · Tacit" };

export default async function DemoRolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const { data, role } = demoRole(decodeURIComponent(roleId));
  if (!role) notFound();
  return (
    <PlatformShell data={data} active={{ page: "memory", roleId: role.roleId }} openAt={1320} scroll>
      <RoleMemoryView role={role} />
    </PlatformShell>
  );
}
