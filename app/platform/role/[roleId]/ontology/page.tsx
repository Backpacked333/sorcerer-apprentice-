import type { Metadata } from "next";
import { OntologyCanvas } from "@/components/platform/OntologyCanvas";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { RoleEmpty } from "@/components/platform/RoleMemoryView";
import { loadOntology } from "@/lib/platform/load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ontology · Simon" };

export default async function OntologyPage({ params, searchParams }: { params: Promise<{ roleId: string }>; searchParams: Promise<{ rule?: string | string[] }> }) {
  const [{ roleId }, sp] = await Promise.all([params, searchParams]);
  const rule = typeof sp.rule === "string" ? sp.rule : null;
  const { data, ontology } = await loadOntology(decodeURIComponent(roleId));
  return (
    <PlatformShell data={data} active={{ page: "ontology", roleId: ontology?.roleId ?? roleId }} scroll={!ontology}>
      {ontology ? <OntologyCanvas ont={ontology} initialRule={rule} /> : <RoleEmpty title="Simon has no ontology for this role yet" href="/platform" />}
    </PlatformShell>
  );
}
