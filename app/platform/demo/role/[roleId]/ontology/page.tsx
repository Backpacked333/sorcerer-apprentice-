import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OntologyCanvas } from "@/components/platform/OntologyCanvas";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { demoOntology } from "@/lib/platform/demo-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ontology (demo) · Tacit" };

export default async function DemoOntologyPage({ params, searchParams }: { params: Promise<{ roleId: string }>; searchParams: Promise<{ rule?: string | string[] }> }) {
  const [{ roleId }, sp] = await Promise.all([params, searchParams]);
  const rule = typeof sp.rule === "string" ? sp.rule : null;
  const { data, ontology } = demoOntology(decodeURIComponent(roleId));
  if (!ontology) notFound();
  return (
    <PlatformShell data={data} active={{ page: "ontology", roleId: ontology.roleId }}>
      <OntologyCanvas ont={ontology} initialRule={rule} />
    </PlatformShell>
  );
}
